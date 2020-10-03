const { Connection, servers } = require('./connectionManager.js');
const EventEmitter = require('events');

const { 
	constants: { COMMANDS, APPS_IDS }, 
	parseOptions, 
	parsers 
} = require('../utils/utils.js');

class Server extends EventEmitter{
	constructor(options) {
		super();

		if(options){
			this.connect(options)
				.catch(console.error);
		}
	}
	connection = null;

	//[infoIsGoldSource, multiPacketResponseIsGoldSource, appID, protocol]
	_info = [false, false, 0, 0];
	options = {};

	getInfo(){
		return new Promise((resolve, reject) => {
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
					resolve(
						Object.assign(
							{ address: this.ip+':'+this.port, ping: Date.now() - start }, 
							...responses.map(parsers.serverInfo)
						)
					)
				)
				.catch(reject);
		});
	}

	getPlayers(){
		return new Promise((resolve, reject) => {
			let key;

			this.challenge(0x55)
				.then(res => {
					if(res[0] === 0x44 && res.length > 5){
						resolve(
							parsers.playersInfo(Buffer.from(res))
						);
					}else{
						key = res;
						return this.connection.send(
							COMMANDS.PLAYERS.concat(...key.slice(1))
						);
					}
				})
				.then(() => this.connection.awaitPacket(0x44))
				.then(buffer => {
					if(Buffer.compare(buffer, Buffer.from(key)) === 0){
						reject(Error('Wrong server response'));
					}
					try{
						resolve(parsers.playersInfo(buffer));
					}catch(e){
						reject(Error('Wrong server response'));
					}
				})
				.catch(reject);
		});
	}

	getRules(){
		return new Promise((resolve, reject) => {
			let key;

			this.challenge(0x56)
				.then(res => {
					if(res[0] === 0x45 && res.length > 5){
						resolve(
							parsers.serverRules(Buffer.from(res))
						);
					}else{
						key = res;
						return this.connection.send(
							COMMANDS.RULES.concat(...res.slice(1))
						);
					}
				})
				.then(() => this.connection.awaitPacket(0x45))
				.then(buffer => {
					if(Buffer.compare(buffer, Buffer.from(key)) === 0){
						reject(Error('Wrong server response'));
					}
				
					try{
						resolve(parsers.serverRules(buffer));
					}catch(e){
						reject(Error('Wrong server response'));
					}
				})
				.catch(reject);
		});
	}

	ping(){
		return new Promise((resolve, reject) => {
			let start;

			this.connection.send(COMMANDS.PING)
				.then(() => {
					start = Date.now();

					return this.connection.awaitPacket(0x6A);
				})
				.then(() => resolve(Date.now() - start))
				.catch(reject);
		});
	}
		
	challenge(code){
		return new Promise(async (resolve, reject) => {
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
				.then(buffer => resolve(Array.from(buffer)))
				.catch(reject);
				
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

		return new Promise(async (resolve, reject) => {
			await this.connection._ready();

			getInfo(this)
				.then(info => {
					Object.assign(this, {
						_info: [info.goldSource, this._info[1], info.appID, info.protocol],
						ready: true
					});
					resolve();
				})
				.catch(reject);
		});
	}

	static init(options){
		return new Server(options);
	}
}

function getInfo(server){
	return new Promise(async (resolve, reject) => {
		if(server.options.debug) console.log('\nSent:    ', Buffer.from(COMMANDS.INFO));

		try{
			await server.connection.send(Buffer.from(COMMANDS.INFO));
		}catch(e){
			reject(e);
		}
	
		let results = await Promise.allSettled([
			server.connection.awaitPacket(0x49),
			server.connection.awaitPacket(0x6d)
		]);
		
		let responses = results.filter(r => r.status === 'fulfilled')
			.map(r => parsers.serverInfo(r.value))
			.sort((a, b) => a.goldSource - b.goldSource);

		if(responses.length === 0){
			return reject(Error('Can not connect to the server.'));
		}

		resolve(Object.assign({}, ...responses));
	});
}

Server.prototype.ping = require('util').deprecate(Server.prototype.ping, 'A2A_PING request is a deprecated feature of source servers');

module.exports = Server;