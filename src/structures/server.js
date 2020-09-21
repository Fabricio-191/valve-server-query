const Connection = require('./connection.js');
const EventEmitter = require('events');

const { 
	constants: { commands, apps_IDs }, 
	parseOptions, 
	parsers 
} = require('../utils/utils.js');

class Server extends EventEmitter{
	constructor(options = {}) {
		super();

		this.connect(options)
		.catch(err => {
			throw err;
		});
	}
	ip = null;
	port = null;
	ready = false;
	
    //[infoIsGoldSource, multiPacketResponseIsGoldSource, appID, protocol]
    _info = [false, false, 0, 0];
	options = {};

	async send(command){
		if(!this.ready) await this._ready();

		if(this.options.debug) console.log('\nSent:    ', Buffer.from(command));
		Connection.client.send(Buffer.from(command), this.port, this.ip, err => {
			if(err) throw err; 
		});
	}
	
	awaitPacket(...packetHeaders){
		const err = Error('Response timeout.');

		return new Promise(async (resolve, reject) => {
            if(!this.ready) await this._ready();

			const timeout = setTimeout(() => {
				this.off('packet', handler);
				reject(err);
			}, this.options.timeout);
			
			const handler = buffer => {
				if(!packetHeaders.includes(buffer[0])) return;

				this.off('packet', handler);
				clearTimeout(timeout);

				resolve(buffer)
			};
					
			this.on('packet', handler)
		})
    }
    
	_ready(){
		return new Promise(resolve => {
			this.once('ready', resolve)
		})  
	}
	
    //-----

	getInfo(){
		return new Promise((resolve, reject) => {
			let start;

			this.send(commands.info)
			.then(() => {
				start = Date.now();

                let requests = [
					this.awaitPacket(0x49)
                ]
				
                if(this._info[0]){
                    requests.push(this.awaitPacket(0x6D))
                }

				return Promise.all(requests)
			})
			.then(responses => 
				resolve(
					Object.assign(
						{ ping: Date.now() - start }, 
						...responses.map(parsers.serverInfo)
					)
				)
			)
			.catch(reject)
		})
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
                    return this.send(
						commands.players.concat(...key.slice(1))
					)
                }
			})
			.then(() => this.awaitPacket(0x44))
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
                    return this.send(
                        commands.rules.concat(...res.slice(1))
                    )
                }
			})
			.then(() => this.awaitPacket(0x45))
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
		});
    }

	ping(){
		return new Promise((resolve, reject) => {
			let start;

			this.send(commands.ping)
			.then(() => {
				start = Date.now();

				return this.awaitPacket(0x6A)
			})
			.then(() => resolve(Date.now() - start))
			.catch(reject)
		})
    }
    
	challenge(code){
		return new Promise(async (resolve, reject) => {
			if(!this.ready) await this._ready();
			
			const command = Array.from(commands.challenge); //(copy)
			if(!apps_IDs.challenge.includes(this._info[2].appID)){
				command[4] = code;
			}
			
			this.send(command)
			.then(() => this.awaitPacket(0x41, 0x45, 0x44))
			//0x45 truncated rules response
			//0x44 truncated players response
			.then(buffer => resolve(Array.from(buffer)))
			.catch(reject);
			
		})
    }
    
    disconnect(){
		if(!this.ready) throw new Error('server is not connected to anything')
		delete Connection.servers[this.ip+':'+this.port];
		
		Object.assign(this, {
			_info: [false, false, 0, 0],
			ready: false
		});
    }

    async connect(options = {}){
        Object.assign(this, parseOptions(options))

		await Connection(this, (info) => {
			Object.assign(this, {
				_info: [info.goldSource, this._info[1], info.appID, info.protocol],
				ready: true
			});
		})
		.catch(err => { throw err })
    }

	static setSocketRef(value){
		if(typeof value !== 'boolean') throw Error("'value' must be a boolean")

		Connection.client[
			value ? 'ref' : 'unref'
		]()
	}
};

Server.prototype.ping = require('util').deprecate(Server.prototype.ping, "A2A_PING request is a deprecated feature of source servers");

module.exports = Server;