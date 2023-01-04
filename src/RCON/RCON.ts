import { EventEmitter } from 'events';
import { parseRCONOptions, type RawRCONOptions, type RCONData } from '../Base/options';
import { createConnection as createSocket, type Socket } from 'net';
import { BufferReader, BufferWriter, debug, delay } from '../Base/utils';

function makeCommand(ID: number, type: PacketType, body = ''): Buffer {
	return new BufferWriter()
		.long(Buffer.byteLength(body) + 10)
		.long(ID)
		.long(type)
		.string(body)
		.byte(0)
		.end();
}

interface Events {
	'disconnect': (reason?: string) => void;
	'passwordChange': () => void;
}

declare interface RCON {
	on<T extends keyof Events>(event: T, listener: Events[T]): this;
	emit<T extends keyof Events>(event: T, ...args: Parameters<Events[T]>): boolean;
}

enum PacketType {
	Auth = 3,
	AuthResponse = 2,
	Command = 2,
	CommandResponse = 0,
}

interface RCONPacket {
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

const PROMISES = {
	NOT_CONNECTED: Promise.reject(new Error('Not connected to server.')),
	NOT_AUTH: Promise.reject(new Error('Not authenticated.')),
};

class RCON extends EventEmitter{
	private _connected: Promise<void> = Promise.reject(new Error('Not connected to server. call RCON.connect() first.'));
	private _auth: Promise<void> = Promise.reject(new Error('Not authenticated. call RCON.connect() first.'));

	public data!: RCONData;
	private socket!: Socket;

	private remaining = 0;
	private buffers: Buffer[] = [];

	private async _send(command: Buffer): Promise<void> {
		await this._connected;
		debug(this.data, 'RCON sending:', command);

		await new Promise<void>((res, rej) => {
			this.socket.write(command, 'ascii', err => {
				if(err) rej(err);
				else res();
			});
		});
	}

	private _awaitResponse(type: PacketType, ...IDs: number[]): Promise<RCONPacket> {
		return this._awaitEvent(
			'packet',
			'Response timeout.',
			(packet: RCONPacket) => packet.type === type && IDs.includes(packet.ID)
		) as Promise<RCONPacket>;
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

	private _reset(): void {
		this._connected = PROMISES.NOT_CONNECTED;
		this._auth = PROMISES.NOT_CONNECTED;

		this.buffers = [];
		this.remaining = 0;
	}

	private onData(buffer: Buffer): void {
		debug(this.data, 'RCON received:', buffer);

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

	public async connect(options: RawRCONOptions): Promise<void> {
		const onError = (err?: Error): void => {
			const reason = err ? err.message : 'The server closed the connection.';
			debug(this.data, `RCON disconnected: ${reason}`);

			this._reset();
			this.emit('disconnect', reason);
		};
		const data = await parseRCONOptions(options);

		this.data = data;
		this.socket = createSocket(data.port, data.ip)
			.unref()
			.on('end', onError)
			.on('error', onError)
			.on('data', this.onData.bind(this));

		debug(this.data, 'RCON connecting');
		this._connected = (async () => {
			await this._awaitEvent('connect', 'Connection timeout.');
			debug(this.data, 'RCON connected');

			await this.authenticate(data.password);
			this._auth = Promise.resolve();
		})();

		await this._connected;
	}
	public async reconnect(): Promise<void> {
		// Tiny delay to avoid "Error: Already connected" while reconnecting
		await delay(1);
		debug(this.data, 'RCON reconnecting...');

		this.socket.connect(this.data.port, this.data.ip);
		await this._awaitEvent('connect', 'Connection timeout.');

		debug(this.data, 'RCON reconnected');

		if(this.listenerCount('passwordChange') === 0){
			await this.authenticate(this.data.password);
		}else{
			try{
				await this.authenticate(this.data.password);
			}catch(e: unknown){
				this._auth = PROMISES.NOT_AUTH;
				if(e instanceof Error && e.message === 'RCON: wrong password'){
					this.emit('passwordChange');
				}else throw e;
			}
		}
	}
	public destroy(): void {
		if(!this.socket) throw new Error('RCON: not connected');
		this.socket.removeAllListeners();
		this.socket.destroy();
	}

	public async exec(command: string): Promise<string> {
		await this._auth;

		const ID = this._getID(), ID2 = this._getID();

		await this._send(makeCommand(ID, PacketType.Command, command));
		await this._send(makeCommand(ID2, PacketType.Command));

		const packets: RCONPacket[] = [
			await this._awaitResponse(PacketType.CommandResponse, ID),
		];
		const cb = (p: RCONPacket): void => {
			if(p.ID === ID) packets.push(p);
		};

		this.socket.on('packet', cb);

		await this._awaitResponse(PacketType.CommandResponse, ID2);
		this.socket.off('packet', cb);

		return packets.map(p => p.body).join('');
	}
	public async authenticate(password: string): Promise<void> {
		await this._connected;
		if(typeof password !== 'string' || password === ''){
			throw new Error('RCON password must be a non-empty string');
		}

		const ID = this._getID();
		await this._send(makeCommand(ID, PacketType.Auth, password));

		this._auth = (async () => {
			const EXEC_RESPONSE = this._awaitResponse(PacketType.CommandResponse, ID);
			const AUTH_RESPONSE = this._awaitResponse(PacketType.AuthResponse, ID, -1);

			const firstResponse = await Promise.race([EXEC_RESPONSE, AUTH_RESPONSE]);

			if(firstResponse.type === 2){
				if(firstResponse.ID === -1){
					throw new Error('RCON: wrong password');
				}
			}else if((await AUTH_RESPONSE).ID === -1){
				throw new Error('RCON: wrong password');
			}
		})();

		this.data.password = password;

		debug(this.data, 'RCON autenticated');
	}

	private _lastID = 0x33333333;
	private _getID(): number {
		if(this._lastID === 0x80000000) this._lastID = -0x80000000;
		return this._lastID++;
	}

	public ref(): void {
		if(!this.socket) throw new Error('RCON: not connected');
		this.socket.ref();
	}
	public unref(): void {
		if(!this.socket) throw new Error('RCON: not connected');
		this.socket.unref();
	}
}

export default RCON;