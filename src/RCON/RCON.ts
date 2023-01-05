import { EventEmitter } from 'events';
import { parseRCONOptions, type RawRCONOptions } from '../Base/options';
import { BufferWriter, debug } from '../Base/utils';
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
	private _connected: Promise<void> | false = false;
	private _auth: Promise<void> | false  = false;

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
			debug(this.connection.data, `RCON disconnected: ${reason}`);

			this._reset();
			this.emit('disconnect', reason);
		};

		this._connected = (async () => {
			const data = await parseRCONOptions(options);

			debug(data, 'RCON connecting');
			this.connection = new Connection(data, onError);

			await this.connection.awaitConnect();
			debug(data, 'RCON connected');
			this.isConnnected = true;
		})();

		await this._connected;
		// @ts-expect-error asdads
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

		if(this._auth) await this._auth;
		else throw new Error('RCON: not authenticated');

		const ID = this._getID(), ID2 = this._getID();

		await this.connection.send(makeCommand(ID, PacketType.Command, command));
		await this.connection.send(makeCommand(ID2, PacketType.Command));

		const packets: RCONPacket[] = [];

		// eslint-disable-next-line no-constant-condition
		while(true){
			const packet = await this.connection.awaitResponse(PacketType.CommandResponse, ID, ID2);
			if(packet.ID === ID2) break;
			packets.push(packet);
		}

		return packets.map(p => p.body).join('');
	}
	public async authenticate(password: string): Promise<void> {
		await this._connected;
		if(typeof password !== 'string' || password === ''){
			throw new Error('RCON password must be a non-empty string');
		}

		const ID = this._getID();
		await this.connection.send(makeCommand(ID, PacketType.Auth, password));

		this._auth = (async () => {
			const AUTH_RESPONSE = await this.connection.awaitResponse(PacketType.AuthResponse, ID, -1);

			if(AUTH_RESPONSE.ID === -1){
				throw new Error('RCON: wrong password');
			}
		})();

		this.connection.data.password = password;

		debug(this.connection.data, 'RCON autenticated');
	}

	private _lastID = 0x33333333;
	private _getID(): number {
		if(this._lastID === 0x80000000) this._lastID = -0x80000000;
		return this._lastID++;
	}

	public ref(): void {
		if(!this.connection) throw new Error('RCON: not connected');
		this.connection.socket.ref();
	}
	public unref(): void {
		if(!this.connection) throw new Error('RCON: not connected');
		this.connection.socket.unref();
	}
}

export default RCON;