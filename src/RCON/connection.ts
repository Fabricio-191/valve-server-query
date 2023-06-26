import type { RCONData } from '../Base/options';
import { createConnection as createSocket, type Socket } from 'net';
import { BufferReader, log, delay } from '../Base/utils';

export interface RCONPacket {
	size: number;
	ID: number;
	type: PacketType;
	body: string;
}

export enum PacketType {
	Auth = 3,
	AuthResponse = 2,
	Command = 2,
	CommandResponse = 0,
}

function parseRCONPacket(buffer: Buffer): RCONPacket {
	const reader = new BufferReader(buffer);

	const data = {
		size: reader.long(),
		ID: reader.long(),
		type: reader.long(),
		body: reader.string('ascii'),
	};

	reader.addOffset(1);
	reader.checkRemaining();

	return data;
}

export default class Connection {
	constructor(data: RCONData, onError: (err?: Error) => void) {
		this.data = data;
		this.socket = createSocket(data.port, data.ip)
			.on('end', onError)
			.on('error', onError)
			.on('data', this.onData.bind(this));
	}
	public readonly socket: Socket;

	public data: RCONData;
	public remaining = 0;
	public buffers: Buffer[] = [];

	public async send(command: Buffer): Promise<void> {
		log(this.data, 'RCON sending:', command);

		await new Promise<void>((res, rej) => {
			this.socket.write(command, 'ascii', err => {
				if(err) rej(err);
				else res();
			});
		});
	}

	public awaitResponse(type: PacketType, ...IDs: number[]): Promise<RCONPacket> {
		return this._awaitEvent(
			'packet',
			'Response timeout.',
			(packet: RCONPacket) => packet.type === type && IDs.includes(packet.ID)
		) as Promise<RCONPacket>;
	}

	public awaitConnect(): Promise<void> {
		return this._awaitEvent('connect', 'Connection timeout.') as Promise<void>;
	}

	private _awaitEvent(
		event: 'connect' | 'packet',
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

	private onData(buffer: Buffer): void {
		log(this.data, 'RCON received:', buffer);

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
	}

	public async reconnect(): Promise<void> {
		// Tiny delay to avoid "Error: Already connected" while reconnecting
		await delay(1);
		log(this.data, 'RCON reconnecting...');

		this.socket.connect(this.data.port, this.data.ip);
		await this.awaitConnect();

		log(this.data, 'RCON reconnected');
	}
}
