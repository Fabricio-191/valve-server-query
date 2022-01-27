const { debug } = require('../../utils/utils.js');
const EventEmitter = require('events');
const createConnection = require('./connection.js');

const RCON_TYPES = {
	EXEC: {
		REQUEST: 2,
		RESPONSE: 0,
	},
	AUTH: {
		REQUEST: 3,
		RESPONSE: 2,
	},
};

class RCON extends EventEmitter{
	connection = null;

	async exec(command){
		if(!await this.connection) throw new Error('RCON is not connected');

		const response = await this.connection.query(command);
		const chunks = [response.body];

		if(response.body.length > 500){
			const packets = await this.connection.awaitMultipleResponse();

			chunks.push(...packets);
		}

		return Buffer
			.concat(chunks)
			.toString('ascii');
	}

	destroy(){
		this.connection.client.destroy();
		this.connection = null;
	}
}

module.exports = async function createRCON(options){
	const connection = await createConnection(options);
	const rcon = new RCON();
	rcon.connection = connection;

	connection.client.once('end', () => {
		rcon.emit('disconnect', 'The server closed the connection.', reconnect.bind(null, rcon, connection));
	});

	connection.client.on('error', err => {
		console.log('error');
		return;
		rcon.emit('disconnect', err.message, reconnect.bind(null, rcon, connection));
	});

	await authenticate(connection);

	return rcon;
};

async function reconnect(rcon, connection){
	console.trace('aa');
	if(connection.options.enableWarns){
		console.warn('RCON: reconnecting...');
	}
	if(connection.options.debug){
		debug('RCON', 'connection closed, reconnecting...');
	}

	await new Promise(res => setTimeout(res, 100));
	await connection.client.connect(connection.port, connection.ip);

	await new Promise((res, rej) => {
		const clear = connection._await('connect', 'Connection closed.', err => {
			clear();
			if(err) rej(err);
			res();
		});
	});

	connection.client.once('end', () => {
		rcon.emit('disconnect', 'The server closed the connection.', reconnect.bind(null, rcon, connection));
	});

	try{
		await authenticate(connection);
	}catch(e){
		rcon.emit('passwordChanged', authenticate.bind(null, connection));
	}
}

async function authenticate(connection, password = connection.password){
	if(password === ''){
		throw new Error('RCON password cannot be an empty string');
	}else if(typeof password !== 'string'){
		throw new Error('RCON password must be a string');
	}else if(password !== connection.password){
		connection.password = password;
	}

	const ID = connection.generateID();

	const [AUTH_RESPONSE] = await Promise.all([
		connection.query(connection.password, ID, RCON_TYPES.AUTH),
		connection.awaitResponse(ID, 0),
	]);

	if(AUTH_RESPONSE.ID === -1){
		throw new Error('RCON: wrong password');
	}

	if(connection.options.debug) debug('RCON', 'autenticated');

	return connection;
}