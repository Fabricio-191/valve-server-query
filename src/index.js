const { constants, parseOptions, parsers } = require('./utils/utils.js');
const Connection = require('./structures/connection.js')

class Server{
	constructor(options = {}) {
		this._connection = new Connection(
			parseOptions(options)
		);
	}
	_connection = null;

	getInfo(){
		const start = Date.now();
		
		return new Promise((resolve, reject) => {
			this.send(constants.commands.info)
			.then(buffer => {
				const info = parsers.serverInfo(buffer);
				info.ping = Date.now() - start;
	
				resolve(info)
			})
			.catch(reject)
		})
	}

	getPlayers(){
		return new Promise((resolve, reject) => {
			this.challenge(0x55)
			.then(key => {
				const command = constants.commands.players.concat(...key.slice(1));
		
				this.send(command)
				.then(buffer => {
					if(Buffer.compare(buffer, Buffer.from(key)) === 0){
						reject(Error('Wrong server response'))
					}
			
					try{
						resolve(parsers.playersInfo(buffer))
					}catch(e){
						reject(Error('Wrong server response'))
					}
				})
				.catch(reject);
			})
			.catch(reject);
		});
	}

	getRules(){
		return new Promise((resolve, reject) => {
			this.challenge(0x56)
			.then(key => {
				if(key[0] === 0x45 && key.length > 5){
					resolve(parsers.serverRules(Buffer.from(key)));
				}
		
				const command = constants.commands.rules.concat(...key.slice(1));
		
				this.send(command)
				.then(buffer => {
					if(Buffer.compare(buffer, Buffer.from(key)) === 0){
						reject(Error('Wrong server response'))
					}
		
					try{
						resolve(parsers.serverRules(buffer))
					}catch(e){
						reject(Error('Wrong server response'))
					}
				})
				.catch(reject);
				
			})
			.catch(reject);

		});
	}
	
	_challenge(code){
		const command = Array.from(constants.commands.challenge); //(copy)
		if(!constants.apps_IDs.challenge.includes(this.appID)){
			command[4] = code;
		}
		
		return new Promise((resolve, reject) => {
			this.send(command)
			.then(buffer => {
				resolve(Array.from(buffer))
			})
			.catch(reject);
		})
	}

	ping(){
		const start = Date.now();
		
		return new Promise((resolve, reject) => {
			this.send(constants.commands.ping)
			.then(() => {
				resolve(Date.now() - start)
			})
			.catch(reject)
		})
	}
};

Server.prototype.ping = require('util').deprecate(Server.prototype.ping, 'Ping method is a deprecated feature of source servers');

module.exports = Server;