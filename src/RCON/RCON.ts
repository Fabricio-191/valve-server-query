import { EventEmitter } from 'events';
import { debug, BufferWriter } from '../Base/utils';
import Connection, { PacketType, type RCONPacket } from './connection';
import { parseRCONOptions, type RawRCONOptions } from '../Base/options';

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

class RCON extends EventEmitter{
	constructor(){
		super();
		this.connection = new Connection();
	}
	private connection: Connection;

	public async exec(command: string, multiPacket = false): Promise<string> {
		await this.connection.mustBeAuth();

		const ID = this._getID();

		await this.connection.send(makeCommand(ID, PacketType.Command, command));
		const packet = await this.connection.awaitResponse(PacketType.CommandResponse, ID);

		if(packet.body.length > 500 || multiPacket || command === 'status' || command === 'cvarlist'){ // multipacket response
			const ID2 = this._getID();
			await this.connection.send(makeCommand(ID2, 2));

			const packets: RCONPacket[] = [];
			const cb = (p: RCONPacket): void => {
				packets.push(p);
			};

			this.connection.socket.on('packet', cb);

			await this.connection.awaitResponse(PacketType.CommandResponse, ID2);
			this.connection.socket.off('packet', cb);

			return [packet.body, ...packets.map(p => p.body)].join('');
		}

		return packet.body;
	}

	public async connect(options: RawRCONOptions): Promise<void> {
		const data = await parseRCONOptions(options);

		await this.connection.connect(this, data);
		await this.authenticate(data.password);
	}

	public async reconnect(): Promise<void> {
		await this.connection.reconnect();

		try{
			await this.authenticate(this.connection.data.password);
		}catch(e: unknown){
			this.connection._auth = false;
			if(e instanceof Error && e.message === 'RCON: wrong password'){
				if(this.connection.data.debug) debug('RCON password changed.');
				this.emit('passwordChange');
			}else throw e;
		}
	}

	public async authenticate(password: string): Promise<void> {
		await this.connection.mustBeConnected();

		if(typeof password !== 'string' || password === ''){
			throw new Error('RCON password must be a non-empty string');
		}

		const ID = this._getID();
		await this.connection.send(makeCommand(ID, PacketType.Auth, password));

		const EXEC_RESPONSE = this.connection.awaitResponse(PacketType.CommandResponse, ID);
		const AUTH_RESPONSE = this.connection.awaitResponse(PacketType.AuthResponse, ID);

		this.connection._auth = (async function(){
			const firstResponse = await Promise.race([EXEC_RESPONSE, AUTH_RESPONSE]);

			if(firstResponse.type === 2){
				if(firstResponse.ID === -1){
					throw new Error('RCON: wrong password');
				}
			}else if((await AUTH_RESPONSE).ID === -1){
				throw new Error('RCON: wrong password');
			}
		})();

		await this.connection.mustBeAuth();
		this.connection.data.password = password;

		if(this.connection.data.debug) debug('RCON autenticated');
	}

	public destroy(): void {
		this.removeAllListeners();
		this.connection.socket.removeAllListeners();
		this.connection.socket.destroy();
		this.connection = new Connection();
	}

	private _lastID = 0x33333333;
	private _getID(): number {
		if(this._lastID === 0x80000000) this._lastID = -0x80000000;
		return this._lastID++;
	}

	public ref(): void {
		this.connection.socket.ref();
	}

	public unref(): void {
		this.connection.socket.unref();
	}
}

export default RCON;