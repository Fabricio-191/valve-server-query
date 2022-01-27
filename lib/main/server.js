const { parsers, debug } = require('../utils/utils.js');
const createConnection = require('./connection.js');

const BIG_F = [0xFF, 0xFF, 0xFF, 0xFF];
const COMMANDS = {
	INFO(key = BIG_F){
		return Buffer.from([
			...BIG_F, 0x54,
			...Buffer.from('Source Engine Query\0'),
			...key,
		]);
	},
	PING: Buffer.from([ ...BIG_F, 0x69 ]),
	CHALLENGE(code = 0x57, key = BIG_F){
		return Buffer.from([ ...BIG_F, code, ...key ]);
	},
};

class Server{
	constructor(connection){
		this.connection = connection;
	}
	connection = null;

	async getInfo(){
		if(!this.connection) throw new Error('server is not connected to anything');

		let command = COMMANDS.INFO();
		if(this.connection._meta.info.challenge){
			const response = await this.connection.query(command, 0x41);
			const key = response.slice(-4);

			command = COMMANDS.INFO(key);
		}

		const requests = [
			this.connection.query(command, 0x49),
		];

		if(this.connection._meta.info.goldSource) requests.push(
			this.connection.awaitResponse(0x6D),
		);

		const start = Date.now();
		const responses = await Promise.all(requests);
		const ping = Date.now() - start;

		return Object.assign({
			address: this.connection.ip+':'+this.connection.port,
			ping,
		}, ...responses.map(parsers.serverInfo));
	}

	async getPlayers(){
		const key = await this.challenge(0x55);

		if(key[0] === 0x44 && key.length > 5){
			return parsers.playersInfo(Buffer.from(key), this.connection._meta);
		}

		const command = Buffer.from([
			...BIG_F, 0x55, ...key.slice(1),
		]);
		const response = await this.connection.query(command, 0x44);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.playersInfo(response, this.connection._meta);
	}

	async getRules(){
		const key = await this.challenge(0x56);

		if(key[0] === 0x45 && key.length > 5){
			return parsers.serverRules(Buffer.from(key));
		}

		const command = Buffer.from([
			...BIG_F, 0x56, ...key.slice(1),
		]);
		const response = await this.connection.query(command, 0x45);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.serverRules(response);
	}

	async getPing(){
		if(!this.connection) throw new Error('server is not connected to anything');
		await this.connection;

		if(this.connection.options.enableWarns){
			console.trace('A2A_PING request is a deprecated feature of source servers');
		}

		const start = Date.now();
		await this.connection.query(COMMANDS.PING, 0x6A);

		return Date.now() - start;
	}

	async challenge(code){
		if(!this.connection) throw new Error('server is not connected');

		const command = COMMANDS.CHALLENGE();
		if(
			![ 17510, 17530, 17740, 17550, 17700 ].includes(this.connection._meta.appID)
		){
			command[4] = code;
		}

		// 0x41 normal challenge response
		// 0x44 truncated rules response
		// 0x45 truncated players response
		const truncatedCode = code - 17;
		const response = await this.connection.query(command, 0x41, truncatedCode);

		return Array.from(response);
	}

	disconnect(){
		this.connection.destroy();

		this.connection = null;
	}
}

module.exports = async function init(options){
	const _meta = {
		info: {
			challenge: false,
			goldSource: false,
		},
		multiPacketResponseIsGoldSource: false,
		appID: null,
		protocol: null,
	};
	const connection = await createConnection(options, _meta);
	const info = await _getInfo(connection);
	if(connection.options.debug) debug('SERVER', 'connected');

	Object.assign(_meta, {
		info: {
			challenge: info.needsChallenge,
			goldSource: info.goldSource,
		},
		multiPacketResponseIsGoldSource: false,
		appID: info.appID,
		protocol: info.protocol,
	});

	const server = new Server(connection);

	return server;
};

module.exports.getInfo = async options => {
	const connection = await createConnection(options);
	const info = await _getInfo(connection);

	connection.destroy();
	return info;
};

async function _getInfo(connection, needsChallenge){
	const info = {
		address: connection.ip+':'+connection.port,
		needsChallenge,
	};

	let command = COMMANDS.INFO();
	if(needsChallenge){
		const response = await connection.query(command, 0x41);
		const key = response.slice(-4);

		command = COMMANDS.INFO(key);
	}

	const results = await Promise.allSettled([
		connection.query(command, 0x49, 0x41),
		connection.awaitResponse(0x6d),
	]);

	const responses = results
		.filter(r => r.status === 'fulfilled')
		// @ts-ignore
		.map(r => r.value);

	if(responses.length === 0){
		throw new Error('can not connect to the server.');
	}else if(responses[0][0] === 0x41){
		// needs challenge
		return await _getInfo(connection, true);
	}

	return Object.assign(info, ...responses.map(parsers.serverInfo));
}