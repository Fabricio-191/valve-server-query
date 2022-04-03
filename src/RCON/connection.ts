import { createConnection, type Socket } from 'net';
import { BufferReader, debug, type BaseOptions } from '../utils';

export interface RCONPacket {
	size: number;
	ID: number;
	type: number;
	body: string;
}

function parseRCONPacket(buffer: Buffer): RCONPacket {
	const reader = new BufferReader(buffer);

	return {
		size: reader.long(),
		ID: reader.long(),
		type: reader.long(),
		body: reader.string(),
	};
	// there is an extra null byte that doesn't matter
}

export interface Options extends BaseOptions{
	password: string;
}

export default class Connection{
	constructor(options: Options){
		this.options = options;

		this.socket = createConnection(options.port, options.ip)
			.unref()
			.on('data', (buffer: Buffer) => {
				if(this.options.debug) debug('RCON recieved:', buffer);

				if(this.remaining === 0){
					this.remaining = buffer.readUInt32LE() + 4; // size field
				}
				this.remaining -= buffer.length;

				if(this.remaining === 0){
					// got the whole packet
					this.socket.emit('packet', parseRCONPacket(
						Buffer.concat(this.buffers.concat(buffer))
					));

					this.buffers = [];
				}else if(this.remaining > 0){
					// needs more packets
					this.buffers.push(buffer);
				}else if(this.remaining < 0){
					// got more than one packet
					this.socket.emit('packet', parseRCONPacket(
						Buffer.concat(this.buffers.concat(
							buffer.slice(0, this.remaining)
						))
					));

					const excess = buffer.slice(this.remaining);

					this.buffers = [];
					this.remaining = 0;

					this.socket.emit('data', excess);
				}
			});

		this._connected = this.awaitEvent('connect', 'Connection timeout.');
	}
	public socket: Socket;
	public options: Options;
	public _connected: Promise<unknown> | null;

	public remaining = 0;
	public buffers: Buffer[] = [];

	public async _ready(): Promise<void> {
		if(this._connected === null){
			throw new Error('Connection is closed.');
		}else await this._connected;
	}

	public async send(command: Buffer): Promise<void> {
		await this._ready();
		if(this.options.debug) debug('RCON sending:', command);

		return await new Promise((res, rej) => {
			this.socket.write(command, 'ascii', err => {
				if(err) rej(err); else res();
			});
		});
	}

	public async awaitResponse(type: number, ID: number): Promise<RCONPacket> {
		await this._ready();

		return await this.awaitEvent(
			'packet',
			'Response timeout.',
			(packet: RCONPacket) => packet.type === type &&
				(packet.ID === ID || packet.ID === -1)
		) as RCONPacket;
	}

	/* eslint-disable @typescript-eslint/no-use-before-define */
	public awaitEvent(
		event: string,
		timeoutMsg: string,
		filter: ((packet: RCONPacket) => unknown) | null = null
	): Promise<unknown> {
		return new Promise((res, rej) => {
			const clear = (): void => {
				this.socket
					.off(event, onEvent)
					.off('error', onError);

				clearTimeout(timeout);
			};

			const onError = (err: unknown): void => {
				clear(); rej(err);
			};
			const onEvent = (arg: RCONPacket): void => { // all events only have 1 argument
				if(filter === null || filter(arg)){
					clear(); res(arg);
				}
			};

			const timeout = setTimeout(onError, this.options.timeout, new Error(timeoutMsg));
			this.socket
				.on(event, onEvent)
				.on('error', onError);
		});
	}
	/* eslint-enable @typescript-eslint/no-use-before-define */
}