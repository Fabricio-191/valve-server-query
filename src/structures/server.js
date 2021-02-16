const { Connection } = require('./connection.js');
const { constants, parsers, debug } = require('../utils/utils.js');

class Server{
	connection = null;

	_meta = {
		infoIsGoldSource: false,
		multiPacketResponseIsGoldSource: false,
		appID: null,
		protocol: null,
	}

	async getInfo(){
		if(!this.connection) throw new Error('server is not connected to anything');
		await this.connection;

		const requests = [
			this.connection.query(constants.COMMANDS.INFO, 0x49)
		];

		if(this._meta.infoIsGoldSource) requests.push(
			this.connection.awaitPacket(0x6D)
		);

		const start = Date.now();
		const responses = await Promise.all(requests);

		return Object.assign({
			address: this.connection.ip+':'+this.connection.port,
			ping: Date.now() - start,
		}, ...responses.map(parsers.serverInfo));
	}

	async getPlayers(){
		const key = await this.challenge(0x55);

		if(key[0] === 0x44 && key.length > 5){
			return parsers.playersInfo(Buffer.from(key));
		}

		const command = constants.COMMANDS.PLAYERS.concat(...key.slice(1));
		const response = await this.connection.query(command, 0x44);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.playersInfo(response);
	}

	async getRules(){
		const key = await this.challenge(0x56);

		if(key[0] === 0x45 && key.length > 5){
			return parsers.serverRules(Buffer.from(key));
		}

		const command = constants.COMMANDS.RULES.concat(...key.slice(1));
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
		await this.connection.query(constants.COMMANDS.PING, 0x6A);

		return Date.now() - start;
	}

	async challenge(code){
		if(!this.connection) throw new Error('server is not connected to anything');
		await this.connection;

		const command = Array.from(constants.COMMANDS.CHALLENGE); // (copy)
		if(!constants.APPS_IDS.CHALLENGE.includes(this._meta.appID)){
			command[4] = code;
		}

		// 0x41 normal challenge response
		// 0x44 truncated rules response
		// 0x45 truncated players response
		const truncatedCode = code - 17;
		const response = await this.connection.query(command, 0x41, truncatedCode);

		return Array.from(response);
	}

	async connect(options){
		if(this.connection) this.disconnect();
		this.connection = (async () => {
			const connection = await Connection(options, this);
			const info = await _getInfo(connection);

			Object.assign(this._meta, {
				infoIsGoldSource: info.goldSource,
				appID: info.appID,
				protocol: info.protocol,
			});

			this.connection = connection;
		})();

		await this.connection;

		if(options.debug) debug('server connected');

		return this;
	}

	disconnect(){
		if(!this.connection) throw new Error('server is not connected to anything');

		this.connection.destroy();

		Object.assign(this, {
			connection: null,
			_meta: {
				infoIsGoldSource: false,
				multiPacketResponseIsGoldSource: false,
				appID: null,
				protocol: null,
			},
		});

		return this;
	}
}

module.exports = function init(options){
	if(options){
		return (new Server).connect(options);
	}

	return new Server;
};

module.exports.getInfo = async options => {
	const connection = await Connection.init(options);
	const info = await _getInfo(connection);

	connection.destroy();
	return info;
};

async function _getInfo(connection){
	const results = await Promise.allSettled([
		connection.query(
			Buffer.from(constants.COMMANDS.INFO), 0x49
		),
		connection.awaitPacket(0x6d)
	]);

	const responses = results
		.filter(r => r.status === 'fulfilled')
		.map(r => parsers.serverInfo(r.value));

	if(responses.length === 0){
		throw new Error('can not connect to the server.');
	}

	return Object.assign({
		address: connection.ip+':'+connection.port,
	}, ...responses);
}