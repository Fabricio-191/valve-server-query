import { createConnection, type Socket } from 'net';
import { BufferReader, debug } from '../Base/utils';
import type { RCONData } from '../Base/options';
import type RCON from './RCON';

// eslint-disable-next-line no-promise-executor-return
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export enum PacketType {
	Auth = 3,
	AuthResponse = 2,
	Command = 2,
	CommandResponse = 0,
}

export interface RCONPacket {
	size: number;
	ID: number;
	type: PacketType;
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

export default class Connection{
	constructor(rcon: RCON, data: RCONData){
		this.data = data;

		this.socket = createConnection(data.port, data.ip)
			.unref()
			.on('data', (buffer: Buffer) => {
				if(this.data.debug) debug('RCON recieved:', buffer);

				if(this.remaining === 0){
					this.remaining = buffer.readUInt32LE() + 4; // size field
				}
				this.remaining -= buffer.length;

				if(this.remaining === 0){ // got the whole packet
					this.buffers.push(buffer);
					this.socket.emit('packet', parseRCONPacket(
						Buffer.concat(this.buffers)
					));

					this.buffers = [];
				}else if(this.remaining > 0){ // needs more packets
					this.buffers.push(buffer);
				}else{ // got more than one packet
					this.buffers.push(buffer.slice(0, this.remaining));
					this.socket.emit('packet', parseRCONPacket(
						Buffer.concat(this.buffers)
					));

					const excess = this.remaining;
					this.buffers = [];
					this.remaining = 0;
					this.socket.emit('data', buffer.slice(excess));
				}
			});

		const onError = (err?: Error): void => {
			const reason = err ? err.message : 'The server closed the connection.';
			if(this.data.debug) debug(`RCON disconnected: ${reason}`);

			this._reset();
			rcon.emit('disconnect', reason);
		};

		this.socket
			.on('end', onError)
			.on('error', onError);
	}
	public readonly data: RCONData;
	public socket: Socket;

	public remaining = 0;
	public buffers: Buffer[] = [];

	public _connected: Promise<unknown> | false = false;
	public _auth: Promise<unknown> | false = false;

	public async mustBeConnected(): Promise<void> {
		if(!this._connected) throw new Error('RCON: not connected/ing.');
		await this._connected;
	}

	public async mustBeAuth(): Promise<void> {
		await this.mustBeConnected();

		if(!this._auth) throw new Error('RCON: not authenticated/ing.');
		await this._auth;
	}

	public async send(command: Buffer): Promise<void> {
		await this.mustBeConnected();

		if(this.data.debug) debug('RCON sending:', command);

		return await new Promise((res, rej) => {
			this.socket.write(command, 'ascii', err => {
				if(err) rej(err);
				else res();
			});
		});
	}

	public async awaitResponse(type: PacketType, ID: number): Promise<RCONPacket> {
		await this.mustBeConnected();

		return await this.awaitEvent(
			'packet',
			'Response timeout.',
			(packet: RCONPacket) => packet.type === type &&
				(packet.ID === ID || packet.ID === -1)
		) as RCONPacket;
	}

	public awaitEvent(
		event: string,
		timeoutMsg: string,
		filter: ((packet: RCONPacket) => unknown) | null = null
	): Promise<unknown> {
		return new Promise((res, rej) => {
			const clear = (): void => {
				/* eslint-disable @typescript-eslint/no-use-before-define */
				this.socket
					.off(event, onEvent)
					.off('error', onError);

				clearTimeout(timeout);
				/* eslint-enable @typescript-eslint/no-use-before-define */
			};

			const onError = (err: unknown): void => {
				clear(); rej(err);
			};
			const onEvent = (arg: RCONPacket): void => { // all events only have 1 argument
				if(filter === null || filter(arg)){
					clear(); res(arg);
				}
			};

			const timeout = setTimeout(onError, this.data.timeout, new Error(timeoutMsg));
			this.socket
				.on(event, onEvent)
				.on('error', onError);
		});
	}

	public async connect(reconnect = false): Promise<void> {
		if(this._connected){
			await this._connected;
			return;
		}

		// Tiny delay to avoid "Error: Already connected" while reconnecting
		await delay(1);
		if(this.data.debug) debug('RCON connecting...');

		this._connected = this.awaitEvent('connect', 'Connection timeout.');

		if(reconnect) this.socket.connect(this.data.port, this.data.ip);

		await this.mustBeConnected();
		if(this.data.debug) debug('RCON connected');
	}

	public _reset(): void {
		this.buffers = [];
		this.remaining = 0;
		this._connected = false;
		this._auth = false;
	}
}
