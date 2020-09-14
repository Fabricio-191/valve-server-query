const  parsers = require('./utils/parsers.js'), 
     constants = require('./utils/constants.json'), 
	Connection = require('./connection.js');

const connectionSymbol = Symbol('connection');

class Server{
	constructor(options = {}) {
		Object.defineProperty(this, connectionSymbol, {
			value: new Connection(
				Object.assign(constants.defaultOptions, options)
			), 
			enumerable: false
		})
	}
	[connectionSymbol] = null;

	getInfo(){
		const start = Date.now();
		
		return new Promise((resolve, reject) => {
			this[connectionSymbol].send(constants.commands.info)
			.then(buffer => {
				const isGoldSource = this[connectionSymbol].isGoldSource
	
				const info = parsers[
					isGoldSource ? 'goldSourceServerInfo' : 'serverInfo'
				](buffer);
		
				Object.assign(info, {
					isGoldSource,
					ping: Date.now() - start
				})
	
				resolve(info)
			})
			.catch(reject)
		})
	}

	getPlayers(){
		return new Promise(async (resolve, reject) => {
			const key = await this[connectionSymbol].challenge(0x55)
			.catch(reject);
	
			const command = constants.commands.players.concat(...key.slice(1));
	
			const buffer = await this[connectionSymbol].send(command)
			.catch(reject);
	
			if(Buffer.compare(buffer, Buffer.from(key)) === 0){
				reject(Error('Wrong server response'))
			}
	
			try{
				resolve(parsers.playersInfo(buffer))
			}catch(e){
				reject(Error('Wrong server response'))
			}
		});
	}

	getRules(){
		return new Promise(async (resolve, reject) => {
			const key = await this[connectionSymbol].challenge(0x56)
			.catch(reject);

			if(key[0] === 0x45 && key.length > 5){
				return parsers.serverRules(Buffer.from(key));
			}
	
			const command = constants.commands.rules.concat(...key.slice(1));
	
			const buffer = await this[connectionSymbol].send(command)
			.catch(reject);
			
			if(Buffer.compare(buffer, Buffer.from(key)) === 0){
				reject(Error('Wrong server response'))
			}

			try{
				resolve(parsers.serverRules(buffer))
			}catch(e){
				reject(Error('Wrong server response'))
			}
		});
	}

	async ping(){
		const start = Date.now();
		
		return new Promise((resolve, reject) => {
			this[connectionSymbol].send(constants.commands.ping)
			.then(() => {
				resolve(Date.now() - start)
			})
			.catch(reject)
		})
	}
};

Server.prototype.ping = require('util').deprecate(Server.prototype.ping, 'Ping method is a deprecated feature of source servers');

module.exports = Server;