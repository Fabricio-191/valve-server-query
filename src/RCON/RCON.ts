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

// I don't like messy code but i had to do it in order to be able to manage reconnections and reauthentication

export default class RCON extends EventEmitter{
	private connection!: Connection;

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
		this.connection = new Connection(this, data);

		await this.connection.connect();
		await this.authenticate(data.password);
	}

	public async reconnect(): Promise<void> {
		await this.connection.connect();

		try{
			await this.authenticate(this.connection.data.password);
		}catch(e: unknown){
			this.connection._auth = false;
			if(e instanceof Error && e.message === 'RCON: wrong password'){
				if(this.connection.data.debug) debug('RCON password changed.');
				this.emit('passwordChange');
			}

			throw e;
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

		const firstResponse = await Promise.race([EXEC_RESPONSE, AUTH_RESPONSE]);

		if(firstResponse.type === 2){
			if(firstResponse.ID === -1){
				throw new Error('RCON: wrong password');
			}
		}else if((await AUTH_RESPONSE).ID === -1){
			throw new Error('RCON: wrong password');
		}

		this.connection.data.password = password;

		if(this.connection.data.debug) debug('RCON autenticated');
	}

	public destroy(): void {
		this.removeAllListeners();
		this.connection.socket.removeAllListeners();
		this.connection.socket.destroy();
	}

	private _lastID = 0x33333333;
	private _getID(): number {
		if(this._lastID === 0x80000000) this._lastID = -0x80000000;
		return this._lastID++;
	}
}
