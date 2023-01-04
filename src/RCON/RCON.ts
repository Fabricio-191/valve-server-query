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

interface Events {
	'disconnect': (reason?: string) => void;
	'passwordChange': () => void;
}

declare interface RCON {
	on<T extends keyof Events>(event: T, listener: Events[T]): this;
	emit<T extends keyof Events>(event: T, ...args: Parameters<Events[T]>): boolean;
}

const PROMISES = {
	NOT_CONNECTED: Promise.reject(new Error('Not connected to server.')),
	NOT_AUTH: Promise.reject(new Error('Not authenticated.')),
};

class RCON extends EventEmitter{
	public isConnnected = false;
	private _connected: Promise<void> = Promise.reject(new Error('Not connected to server. call RCON.connect() first.'));
	private _auth: Promise<void> = Promise.reject(new Error('Not authenticated. call RCON.connect() first.'));

	private connection!: Connection;

	private _reset(): void {
		this._connected = PROMISES.NOT_CONNECTED;
		this._auth = PROMISES.NOT_CONNECTED;

		this.connection.buffers = [];
		this.connection.remaining = 0;
	}

	public async connect(options: RawRCONOptions): Promise<void> {
		if(this.connection) throw new Error('Already connected to server.');
		const onError = (err?: Error): void => {
			const reason = err ? err.message : 'The server closed the connection.';
			debug(this.connection.data, `RCON disconnected: ${reason}`);

			this._reset();
			this.isConnnected = false;
			this.emit('disconnect', reason);
		};
		const data = await parseRCONOptions(options);

		this.connection = new Connection(data, onError);
		this.connection.data = data;

		debug(this.connection.data, 'RCON connecting');
		this._connected = (async () => {
			await this.connection.awaitConnect();
			debug(this.connection.data, 'RCON connected');
			this.isConnnected = true;

			await this.authenticate(data.password);
			this._auth = Promise.resolve();
		})();

		await this._connected;
	}
	public async reconnect(): Promise<void> {
		await this.connection.reconnect();
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
	}

	public async exec(command: string): Promise<string> {
		await this._auth;

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
			const EXEC_RESPONSE = this.connection.awaitResponse(PacketType.CommandResponse, ID);
			const AUTH_RESPONSE = this.connection.awaitResponse(PacketType.AuthResponse, ID, -1);

			const firstResponse = await Promise.race([EXEC_RESPONSE, AUTH_RESPONSE]);

			if(firstResponse.type === 2){
				if(firstResponse.ID === -1){
					throw new Error('RCON: wrong password');
				}
			}else if((await AUTH_RESPONSE).ID === -1){
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