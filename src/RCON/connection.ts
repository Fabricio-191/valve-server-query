import { createConnection, type Socket } from 'net';
import { BufferReader, debug } from '../utils';
import type { Data } from './RCON';

export enum PacketType {
	Auth = 3,
	AuthResponse = 2,
	Command = 2,
	CommandResponse = 0
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
	constructor(data: Data){
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

		this._connected = this.awaitEvent('connect', 'Connection timeout.');
	}
	public socket: Socket;
	public data: Data;
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
		if(this.data.debug) debug('RCON sending:', command);

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

			const timeout = setTimeout(onError, this.data.timeout, new Error(timeoutMsg));
			this.socket
				.on(event, onEvent)
				.on('error', onError);
		});
	}
	/* eslint-enable @typescript-eslint/no-use-before-define */
}
