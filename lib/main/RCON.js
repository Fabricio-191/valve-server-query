const EventEmitter = require('events');
const net = require('net');
const utils = require('../utils/utils.js');

const makeCommand = (ID, type, body = '') =>
	new utils.BufferWriter()
		.long(Buffer.byteLength(body) + 10)
		.long(ID)
		.long(type)
		.string(body)
		.byte(0)
		.end();

function manageBuffer(connection, buffer){
	if(connection.options.debug) utils.debug('RCON', 'recieved:', buffer);

	if(connection.remaining === 0){
		connection.remaining = buffer.readUInt32LE() + 4; // size field
	}
	connection.remaining -= buffer.length;

	if(connection.remaining === 0){
		// got the whole packet
		connection.socket.emit('packet', utils.parsers.RCONPacket(
			Buffer.concat(connection.buffers.concat(buffer)),
		));

		connection.buffers = [];
		connection.remaining = 0;
	}else if(connection.remaining > 0){
		// needs more packets
		connection.buffers.push(buffer);
	}else if(connection.remaining < 0){
		// got more than one packet
		connection.socket.emit('packet', utils.parsers.RCONPacket(
			Buffer.concat(connection.buffers.concat(
				buffer.slice(0, connection.remaining),
			)),
		));

		connection.buffers = [];
		const excess = connection.remaining;
		connection.remaining = 0;
		connection.socket.emit('data', buffer.slice(excess));
	}
}

class Connection{
	constructor(options){
		this.options = options;

		this.socket = net
			.createConnection(options.port, options.ip)
			.unref()
			.on('data', manageBuffer.bind(null, this));

		this._connected = this.awaitEvent('connect', 'Connection timeout.');
	}
	socket = null;
	options = {};
	_connected = null;

	remaining = 0;
	buffers = [];

	async _ready(){
		if(this._connected === null){
			throw new Error('Connection is closed.');
		}else await this._connected;
	}

	async send(command){
		await this._ready();
		if(this.options.debug) utils.debug('RCON', 'sending:', command);

		return await new Promise((res, rej) => {
			this.socket.write(command, 'ascii', err => {
				if(err) rej(err);
				else res();
			});
		});
	}

	async awaitResponse(type, ID){
		await this._ready();

		return await this.awaitEvent(
			'packet',
			'Response timeout.',
			packet => packet.type === type &&
				(packet.ID === ID || packet.ID === -1),
		);
	}

	awaitEvent(event, timeoutMsg, filter){
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
			if(this.connection.options.debug) utils.debug('RCON', 'disconnected.');

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
		this.connection.client.destroy();
	}

	async reconnect(){
		if(this.connection._connected !== null) return;
		const { connection } = this;

		// Tiny delay to avoid "Error: Already connected" while reconnecting
		await new Promise(res => { setTimeout(res, 100); });
		if(connection.options.debug) utils.debug('RCON', 'reconnecting...');

		connection._connected = connection.awaitEvent('connect', 'Connection timeout.');

		connection.socket.connect(
			connection.options.port,
			connection.options.ip,
		).unref();

		await connection._connected;
		if(connection.options.debug) utils.debug('RCON', 'connected');

		try{
			await this.authenticate(connection.options.password);
		}catch(e){
			this._auth = null;
			if(e.message !== 'RCON: wrong password') throw e;

			if(connection.options.debug) utils.debug('RCON', 'password changed.');
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

		if(this.connection.options.debug) utils.debug('RCON', 'autenticated');
	}

	_lastID = 0x33333333;
	_getID(){
		if(this._lastID === 0x80000000) this._lastID = -0x80000000;
		return this._lastID++;
	}
}

module.exports = async function createRCON(options){
	const rcon = new RCON(
		await utils.parseOptions(options),
	);
	if(rcon.connection.options.debug) utils.debug('RCON', 'connecting...');

	await rcon.connection._connected;
	if(rcon.connection.options.debug) utils.debug('RCON', 'connected');
	await rcon.authenticate(options.password);

	return rcon;
};