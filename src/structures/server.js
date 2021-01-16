const { Connection, servers } = require('./connectionManager.js');

const { 
	constants: { COMMANDS, APPS_IDS }, 
	parseOptions, 
	parsers 
} = require('../utils/utils.js');

class Server{
	constructor(options) {
		if(options){
			this.connect(options)
				.catch(console.error);
		}
	}
	connection = null;

	//[infoIsGoldSource, multiPacketResponseIsGoldSource, appID, protocol]
	_info = [false, false, 0, 0];
	
	ip = null;
	port = null;
	options = {};

	getInfo(){
		return new Promise((res, rej) => {
			let start;

			this.connection.send(COMMANDS.INFO)
				.then(() => {
					start = Date.now();

					let requests = [
						this.connection.awaitPacket(0x49)
					];
						
					if(this._info[0]){
						requests.push(
							this.connection.awaitPacket(0x6D)
						);
					}

					return Promise.all(requests);
				})
				.then(responses => 
					res(
						Object.assign(
							{ address: this.ip+':'+this.port, ping: Date.now() - start }, 
							...responses.map(parsers.serverInfo)
						)
					)
				)
				.catch(rej);
		});
	}

	getPlayers(){
		return new Promise((res, rej) => {
			let key;

			this.challenge(0x55)
				.then(response => {
					if(response[0] === 0x44 && response.length > 5){
						res(
							parsers.playersInfo(Buffer.from(response))
						);
					}else{
						key = response;

						return this.connection.send(
							COMMANDS.PLAYERS.concat(...response.slice(1))
						);
					}
				})
				.then(() => this.connection.awaitPacket(0x44))
				.then(buffer => {
					if(Buffer.compare(buffer, Buffer.from(key)) === 0){
						rej(Error('Wrong server response'));
					}
					try{
						res(parsers.playersInfo(buffer));
					}catch(e){
						rej(Error('Wrong server response'));
					}
				})
				.catch(rej);
		});
	}

	getRules(){
		return new Promise((res, rej) => {
			let key;

			this.challenge(0x56)
				.then(response => {
					if(response[0] === 0x45 && response.length > 5){
						res(
							parsers.serverRules(Buffer.from(response))
						);
					}else{
						key = response;
						return this.connection.send(
							COMMANDS.RULES.concat(...response.slice(1))
						);
					}
				})
				.then(() => this.connection.awaitPacket(0x45))
				.then(buffer => {
					if(Buffer.compare(buffer, Buffer.from(key)) === 0){
						rej(Error('Wrong server response'));
					}
				
					try{
						res(parsers.serverRules(buffer));
					}catch(e){
						rej(Error('Wrong server response'));
					}
				})
				.catch(rej);
		});
	}

	ping(){
		return new Promise((res, rej) => {
			let start;

			this.connection.send(COMMANDS.PING)
				.then(() => {
					start = Date.now();

					return this.connection.awaitPacket(0x6A);
				})
				.then(() => res(Date.now() - start))
				.catch(rej);
		});
	}
		
	challenge(code){
		return new Promise(async (res, rej) => {
			if(!this.connection.ready) await this.connection._ready();
				
			const command = Array.from(COMMANDS.CHALLENGE); //(copy)
			if(!APPS_IDS.CHALLENGE.includes(this._info[2])){
				command[4] = code;
			}

			//0x41 normal challenge response
			//0x45 truncated rules response
			//0x44 truncated players response
				
			this.connection.send(command)
				.then(() => this.connection.awaitPacket(0x41, 0x45, 0x44))
				.then(buffer => res(Array.from(buffer)))
				.catch(rej);
				
		});
	}
		
		
	disconnect(){
		if(!this.connection) throw new Error('server is not connected to anything');
		delete servers[this.ip+':'+this.port];

		this.connection.destroy();
			
		Object.assign(this, {
			connection: null,
			_info: [false, false, 0, 0],
			ready: false
		});
	}

	connect(options){
		Object.assign(this, parseOptions(options));
		this.connection = new Connection(this);

		return new Promise(async (res, rej) => {
			await this.connection._ready();

			getInfo(this)
				.then(info => {
					Object.assign(this, {
						_info: [info.goldSource, this._info[1], info.appID, info.protocol],
						ready: true
					});
					res();
				})
				.catch(rej);
		});
	}

	static init(options){
		return new Server(options);
	}
}

function getInfo(server){
	return new Promise(async (res, rej) => {
		if(server.options.debug) console.log('\nSent:    ', Buffer.from(COMMANDS.INFO));

		try{
			await server.connection.send(Buffer.from(COMMANDS.INFO));
		}catch(e){
			return rej(e);
		}
	
		let results = await Promise.allSettled([
			server.connection.awaitPacket(0x49),
			server.connection.awaitPacket(0x6d)
		]);
		
		let responses = results.filter(r => r.status === 'fulfilled')
			.map(r => parsers.serverInfo(r.value))
			.sort((a, b) => a.goldSource - b.goldSource);

		if(responses.length === 0){
			return rej(Error('Can not connect to the server.'));
		}

		res(Object.assign({}, ...responses));
	});
}

Server.prototype.ping = require('util').deprecate(Server.prototype.ping, 'A2A_PING request is a deprecated feature of source servers');

module.exports = Server;