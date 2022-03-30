import { EventEmitter } from 'events';
import type { Socket } from 'net';
import { debug, BufferWriter } from '../utils/utils';
import { RCONPacket } from '../utils/parsers';
import { createConnection } from 'net';

const makeCommand = (ID: number, type: number, body = ''): Buffer =>
	new BufferWriter()
		.long(Buffer.byteLength(body) + 10)
		.long(ID)
		.long(type)
		.string(body)
		.byte(0)
		.end();

class Connection{
	constructor(options){
		this.options = options;

		this.socket = createConnection(options.port, options.ip)
			.unref()
			.on('data', (buffer: Buffer) => {
				if(this.options.debug) debug('RCON', 'recieved:', buffer);
			
				if(this.remaining === 0){
					this.remaining = buffer.readUInt32LE() + 4; // size field
				}
				this.remaining -= buffer.length;
			
				if(this.remaining === 0){
					// got the whole packet
					this.socket.emit('packet', RCONPacket(
						Buffer.concat(this.buffers.concat(buffer)),
					));
			
					this.buffers = [];
					this.remaining = 0;
				}else if(this.remaining > 0){
					// needs more packets
					this.buffers.push(buffer);
				}else if(this.remaining < 0){
					// got more than one packet
					this.socket.emit('packet', RCONPacket(
						Buffer.concat(this.buffers.concat(
							buffer.slice(0, this.remaining),
						)),
					));
			
					this.buffers = [];
					const excess = this.remaining;
					this.remaining = 0;
					this.socket.emit('data', buffer.slice(excess));
				}
			});

		this._connected = this.awaitEvent('connect', 'Connection timeout.');
	}
	socket: Socket;
	options = {};
	_connected: Promise<void> | null;

	remaining = 0;
	buffers: Buffer[] = [];

	async _ready(){
		if(this._connected === null){
			throw new Error('Connection is closed.');
		}else await this._connected;
	}

	async send(command){
		await this._ready();
		if(this.options.debug) debug('RCON', 'sending:', command);

		return await new Promise((res, rej) => {
			this.socket.write(command, 'ascii', err => {
				if(err) rej(err);
				else res();
			});
		});
	}

	async awaitResponse(type: number, ID: number){
		await this._ready();

		return await this.awaitEvent(
			'packet',
			'Response timeout.',
			packet => packet.type === type &&
				(packet.ID === ID || packet.ID === -1),
		);
	}

	awaitEvent(event, timeoutMsg, filter?: (packet: {}) => unknown): Promise<void> {
		return new Promise((res, rej) => {
			// eslint-disable-next-line prefer-const
			let clear;

			const onError = err => { clear(); rej(err); };
			const onEvent = arg => { // all events only have 1 argument
				if(!filter || filter(arg)){
					clear(); res(arg);
				}
			};

			const timeout = setTimeout(onError, this.options.timeout, new Error(timeoutMsg));
			this.socket
				.on(event, onEvent)
				.on('error', onError);

			clear = () => {
				this.socket
					.off(event, onEvent)
					.off('error', onError);

				clearTimeout(timeout);
			};
		});
	}
}

class RCON extends EventEmitter{
	constructor(options){
		super();
		this.connection = new Connection(options);

		const cb = err => {
			if(this.connection.options.debug) debug('RCON', 'disconnected.');

			this.connection.buffers = [];
			this.connection.remaining = 0;
			this.connection._connected = null;
			this._auth = null;

			this.emit(
				'disconnect',
				err ? err.message : 'The server closed the connection.',
			);
		};

		this.connection.socket
			.on('end', cb)
			.on('error', cb);
	}
	connection = null;
	_auth = null;

	async _ready(){
		await this.connection._ready();

		if(this._auth === null){
			throw new Error('RCON: not authenticated.');
		}else await this._auth;
	}

	async exec(command, multiPacket = false){
		await this._ready();

		const ID = this._getID();

		await this.connection.send(makeCommand(ID, 2, command));
		const packet = await this.connection.awaitResponse(0, ID);

		if(
			packet.body.length > 500 || multiPacket ||
			command === 'cvarlist' || command === 'status'
		){
			const ID2 = this._getID();
			await this.connection.send(makeCommand(ID2, 2));

			const packets = [];
			const cb = p => packets.push(p);

			this.connection.socket.on('packet', cb);

			await this.connection.awaitResponse(0, ID2);
			this.connection.socket.off('packet', cb);

			return [packet.body, ...packets.map(p => p.body)].join('');
		}

		return packet.body;
	}

	destroy(){
		this.removeAllListeners();
		this.connection.client.removeAllListeners();
		this.connection.client.destroy();
	}

	async reconnect(){
		if(this.connection._connected !== null) return;
		const { connection } = this;

		// Tiny delay to avoid "Error: Already connected" while reconnecting
		await new Promise(res => { setTimeout(res, 100); });
		if(connection.options.debug) debug('RCON', 'reconnecting...');

		connection._connected = connection.awaitEvent('connect', 'Connection timeout.');

		connection.socket.connect(
			connection.options.port,
			connection.options.ip,
		).unref();

		await connection._connected;
		if(connection.options.debug) debug('RCON', 'connected');

		try{
			await this.authenticate(connection.options.password);
		}catch(e){
			this._auth = null;
			if(e.message !== 'RCON: wrong password') throw e;

			if(connection.options.debug) debug('RCON', 'password changed.');
			this.emit('passwordChange');
		}
	}

	async authenticate(password){
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

		if(this.connection.options.debug) debug('RCON', 'autenticated');
	}

	_lastID = 0x33333333;
	_getID(){
		if(this._lastID === 0x80000000) this._lastID = -0x80000000;
		return this._lastID++;
	}
}

export default async function createRCON(options){
	const rcon = new RCON(
		await parseOptions(options),
	);
	if(rcon.connection.options.debug) debug('RCON', 'connecting...');

	await rcon.connection._connected;
	if(rcon.connection.options.debug) debug('RCON', 'connected');
	await rcon.authenticate(options.password);

	return rcon;
};