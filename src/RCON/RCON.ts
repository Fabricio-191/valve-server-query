import { EventEmitter } from 'events';
import { parseRCONOptions, type RawRCONOptions } from '../Base/options';
import { BufferWriter, log, delay } from '../Base/utils';
import Connection, { PacketType, type RCONPacket } from './connection';

function makeCommand(ID: number, type: PacketType, body = ''): Buffer {
	return new BufferWriter()
		.long(Buffer.byteLength(body) + 10)
		.long(ID)
		.long(type)
		.string(body)
		.byte(0)
		.end();
}

declare interface RCON {
	on(event: 'disconnect', listener: (reason: string) => void): this;
	on(event: 'passwordChange', listener: () => void): this;
	emit(event: 'disconnect', reason: string): boolean;
	emit(event: 'passwordChange'): boolean;
}

class RCON extends EventEmitter{
	public isConnnected = false;
	private _connected: Promise<void> | boolean = false;
	private _auth: Promise<void> | boolean = false;

	private connection!: Connection;

	private _reset(): void {
		this.connection.buffers = [];
		this.connection.remaining = 0;

		this._connected = this._auth = false;
		this.isConnnected = false;
	}

	public async connect(options: RawRCONOptions): Promise<void> {
		if(this.connection) throw new Error('Already connected to server.');

		const onError = (err?: Error): void => {
			const reason = err ? err.message : 'The server closed the connection.';
			if(log.isEnabled) log.message(this.connection.data, `RCON disconnected: ${reason}`);

			this._reset();
			this.emit('disconnect', reason);
		};

		this._connected = (async () => {
			const data = parseRCONOptions(options);

			if(log.isEnabled) log.message(data, 'RCON connecting');
			this.connection = new Connection(data, onError);

			if(this._ref) this.connection.socket.ref();
			else this.connection.socket.unref();

			await this.connection.awaitConnect();
			if(log.isEnabled) log.message(data, 'RCON connected');
			this.isConnnected = true;
		})();

		await this._connected;

		// @ts-expect-error asd
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		await this.authenticate(this.connection.data.password);
	}
	public async reconnect(): Promise<void> {
		if(!this.connection) throw new Error('RCON: not connected, call RCON.connect() first');
		if(this._connected) throw new Error('RCON: already connected');

		this._connected = this.connection.reconnect();
		await this._connected;
		this.isConnnected = true;

		if(this.listenerCount('passwordChange') === 0){
			await this.authenticate(this.connection.data.password);
		}else{
			try{
				await this.authenticate(this.connection.data.password);
			}catch(e: unknown){
				if(e instanceof Error && e.message === 'RCON: wrong password'){
					this.emit('passwordChange');
				}else throw e;
			}
		}
	}
	public destroy(): void {
		if(!this.connection) throw new Error('RCON: not connected');
		this.connection.socket.removeAllListeners();
		this.connection.socket.destroy();
		this._reset();
	}

	public async exec(command: string): Promise<string> {
		if(this._connected) await this._connected;
		else throw new Error('RCON: not connected');

		await delay(1);
		if(this._auth) await this._auth;
		else throw new Error('RCON: not authenticated');

		const ID = this._getID(), ID2 = this._getID();

		await this.connection.send(makeCommand(ID, PacketType.Command, command));
		await this.connection.send(makeCommand(ID2, PacketType.Command));

		const packets: RCONPacket[] = [];

		const cb = (packet: RCONPacket): void => {
			if(packet.ID === ID) packets.push(packet);
		};

		this.connection.socket.on('packet', cb);
		await this.connection.awaitResponse(PacketType.CommandResponse, ID2);
		this.connection.socket.off('packet', cb);

		return packets.map(p => p.body).join('');
	}
	public async authenticate(password: string): Promise<void> {
		if(this._connected) await this._connected;
		else throw new Error('RCON: not connected');

		if(this._auth) throw new Error('RCON: already authenticated');

		if(typeof password !== 'string' || password === ''){
			throw new Error('RCON password must be a non-empty string');
		}

		const ID = this._getID();
		await this.connection.send(makeCommand(ID, PacketType.Auth, password));

		this._auth = (async () => {
			const AUTH_RESPONSE = await this.connection.awaitResponse(PacketType.AuthResponse, ID, -1);

			if(AUTH_RESPONSE.ID === -1){
				this._auth = false;
				throw new Error('RCON: wrong password');
			}
		})();

		await this._auth;

		this.connection.data.password = password;

		if(log.isEnabled) log.message(this.connection.data, 'RCON autenticated');
	}

	private _lastID = 0x33333333;
	private _getID(): number {
		if(this._lastID === 0x80000000) this._lastID = -0x80000000;
		return this._lastID++;
	}

	private _ref = true;
	public ref(): this {
		this._ref = true;
		if(this.connection) this.connection.socket.ref();

		return this;
	}
	public unref(): this {
		this._ref = false;
		if(this.connection) this.connection.socket.unref();

		return this;
	}
}

export default RCON;