import { EventEmitter } from 'events';
import { debug, BufferWriter, parseOptions as parseBaseOptions } from '../utils';
import Connection, { type RCONPacket, type Options } from './connection';

function makeCommand(ID: number, type: number, body = ''): Buffer {
	return new BufferWriter()
		.long(Buffer.byteLength(body) + 10)
		.long(ID)
		.long(type)
		.string(body)
		.byte(0)
		.end();
}

const LONG = ['cvarlist', 'status'];
class RCON extends EventEmitter{
	constructor(options: Options){
		super();
		this.connection = new Connection(options);

		const cb = (err?: Error): void => {
			if(this.connection.options.debug) debug('RCON disconnected.');

			this.connection.buffers = [];
			this.connection.remaining = 0;
			this.connection._connected = null;
			this._auth = null;

			this.emit(
				'disconnect',
				err ? err.message : 'The server closed the connection.'
			);
		};

		this.connection.socket
			.on('end', cb)
			.on('error', cb);
	}
	public connection: Connection;
	private _auth: Promise<void> | null = null;

	public async _ready(): Promise<void> {
		await this.connection._ready();

		if(this._auth === null){
			throw new Error('RCON: not authenticated.');
		}else await this._auth;
	}

	public async exec(command: string, multiPacket = false): Promise<string> {
		await this._ready();

		const ID = this._getID();

		await this.connection.send(makeCommand(ID, 2, command));
		const packet = await this.connection.awaitResponse(0, ID);

		if(
			packet.body.length > 500 || multiPacket ||
			LONG.includes(command)
		){
			const ID2 = this._getID();
			await this.connection.send(makeCommand(ID2, 2));

			const packets: RCONPacket[] = [];
			const cb = (p: RCONPacket): void => {
				packets.push(p);
			};

			this.connection.socket.on('packet', cb);

			await this.connection.awaitResponse(0, ID2);
			this.connection.socket.off('packet', cb);

			return [packet.body, ...packets.map(p => p.body)].join('');
		}

		return packet.body;
	}

	public destroy(): void {
		this.removeAllListeners();
		this.connection.socket.removeAllListeners();
		this.connection.socket.destroy();
	}

	public async reconnect(): Promise<void> {
		if(this.connection._connected !== null) return;

		// Tiny delay to avoid "Error: Already connected" while reconnecting
		await new Promise(res => {
			setTimeout(res, 100);
		});
		if(this.connection.options.debug) debug('RCON reconnecting...');

		this.connection._connected = this.connection.awaitEvent('connect', 'Connection timeout.');

		this.connection.socket.connect(
			this.connection.options.port,
			this.connection.options.ip
		).unref();

		await this.connection._connected;
		if(this.connection.options.debug) debug('RCON connected');

		try{
			await this.authenticate(this.connection.options.password);
		}catch(e: unknown){
			this._auth = null;
			if(e instanceof Error && e.message !== 'RCON: wrong password') throw e;

			if(this.connection.options.debug) debug('RCON password changed.');
			this.emit('passwordChange');
		}
	}

	public async authenticate(password: string): Promise<void> {
		if(this._auth !== null) return await this._auth;
		await this.connection._ready();

		if(typeof password !== 'string' || password === ''){
			throw new Error('RCON password must be a non-empty string');
		}

		const ID = this._getID();
		await this.connection.send(makeCommand(ID, 3, password));

		const EXEC_RESPONSE = this.connection.awaitResponse(0, ID);
		const AUTH_RESPONSE = this.connection.awaitResponse(2, ID);

		this._auth = (async () => {
			const firstResponse = await Promise.race([EXEC_RESPONSE, AUTH_RESPONSE]);

			if(firstResponse.type === 2){
				if(firstResponse.ID === -1){
					throw new Error('RCON: wrong password');
				}
			}else if((await AUTH_RESPONSE).ID === -1){
				throw new Error('RCON: wrong password');
			}
		})();

		await this._auth;
		this.connection.options.password = password;

		if(this.connection.options.debug) debug('RCON autenticated');
	}

	private _lastID = 0x33333333;
	private _getID(): number {
		if(this._lastID === 0x80000000) this._lastID = -0x80000000;
		return this._lastID++;
	}
}

interface RawOptions extends Partial<Options> {
	password: string;
}

export default async function createRCON(options: RawOptions): Promise<RCON> {
	const opts = await parseBaseOptions(options) as Options;

	if(typeof opts.password !== 'string'){
		throw new Error('RCON password must be a string');
	}

	const rcon = new RCON(opts);
	if(opts.debug) debug('RCON connecting...');

	await rcon.connection._connected;
	if(opts.debug) debug('RCON connected');
	await rcon.authenticate(options.password);

	return rcon;
}