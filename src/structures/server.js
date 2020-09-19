const { constants, parseOptions, parsers } = require('../utils/utils.js');
const Connection = require('./connection.js');

class Server{
	constructor(options = {}) {
		Object.defineProperty(this, '_connection', {
			value: new Connection(
				parseOptions(options)
			),
			enumerable: false
		});
	}
	_connection = null;

	getInfo = function(){
		const start = Date.now();
		
		return new Promise(async (resolve, reject) => {
			this._connection.send(constants.commands.info, reject);

			let responses = [
				this._connection.awaitResponse(0x49)
			]

			if(this._connection.isGoldSource){
				responses.push(
					this._connection.awaitResponse(0x6D)
				)
			}

			Promise.all(responses)
			.then(responses => {
				const info = Object.assign(...responses.map(parsers.serverInfo));
				info.ping = Date.now() - start;

				resolve(info)
			})
			.catch(reject)
		})
	}

	getPlayers = function(){
		return new Promise((resolve, reject) => {
			this._challenge(0x55)
			.then(key => {
				const command = constants.commands.players.concat(...key.slice(1));
		
				this._connection.send(command, reject);
				
				this._connection.awaitResponse(0x44)
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

	getRules = function(){
		return new Promise((resolve, reject) => {
			this._challenge(0x56)
			.then(key => {
				if(key[0] === 0x45 && key.length > 5){
					return resolve(
						parsers.serverRules(Buffer.from(key))
					);
				}
		
				const command = constants.commands.rules.concat(...key.slice(1));
		
				this._connection.send(command, reject)

				this._connection.awaitResponse(0x45)
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
		if(!constants.apps_IDs.challenge.includes(this._connection.appID)){
			command[4] = code;
		}
		
		return new Promise((resolve, reject) => {
			this._connection.send(command, reject)
			
			this._connection.awaitResponse(0x41)
			.then(buffer => {
				resolve(Array.from(buffer))
			})
			.catch(reject);
		})
	}

	ping(){
		const start = Date.now();
		
		return new Promise((resolve, reject) => {
			this.send(constants.commands.ping, reject)
			
			this._connection.awaitResponse(0x6A)
			.then(() => {
				resolve(Date.now() - start)
			})
			.catch(reject)
		})
	}

	static setSocketRef(value){
		if(typeof value !== 'boolean') throw Error("'value' must be a boolean")

		Connection.client[
			value ? 'ref' : 'unref'
		]()
	}
};

module.exports = Server;