const { constants, parseOptions, parsers, decompressBZip } = require('./utils/utils.js');
const client = require('dgram').createSocket('udp4');
const EventEmitter = require('events');

class Server extends EventEmitter{
	constructor(options = {}) {
		super();

		client.on('message', this.packetHandler.bind(this))
		
		Object.assign(this, parseOptions(options))

		if(options.debug){
			client.on('message', (buffer, rinfo) => console.log('received:', buffer));
			this.debug = true;
		}
		
		let timeout = setTimeout(() => {
			throw Error('Can not connect to the server.');
		}, this.timeout * 2)

		this.send(constants.commands.info, true)
		.then(buffer => {
			let isGoldSource = buffer[0] === 0x6D;

			let info = parsers[
				isGoldSource ? 'goldSourceServerInfo' : 'serverInfo'
			](buffer)

			Object.assign(this, {
				protocol: info.protocol,
				appID: info.appID,
				isGoldSource,
				ready: true
			})

			clearTimeout(timeout)
			this.emit('ready');
		})
		.catch(() => {})
	}
	ready = false;

	ip = null
	port = 27015

	protocol = null;
	appID = null;
	isGoldSource = false;

	timeout = 3000;

	send(command, bypass = false){
		return new Promise(async (resolve, reject) => {
			if(this.ip instanceof Promise) await this.ip;
			if(!this.ready && !bypass) await this._ready();

			const responseHeaders = constants.responsesHeaders[
				command[4]
			];
				
			if(this.debug) console.log('\nsent:    ', Buffer.from(command));
			
			client.send(Buffer.from(command), this.port, this.ip, err => {
				if(err) reject(err);
			});
	
			const timeout = setTimeout(() => {
				this.removeListener('packet', handler);
				reject(Error('Response timeout.'));
			}, this.timeout);
					
			const handler = buffer => {
				if(!responseHeaders.includes(buffer[0])) return;
	
				this.off('packet', handler)
				clearTimeout(timeout);

				resolve(buffer)
			};
					
			this.on('packet', handler)
		})
	}

	packetsQueues = {};
	packetHandler(buffer, rinfo){
		if(
			rinfo.address !== this.ip || rinfo.port !== this.port || 
			buffer.length === 0
		) return;
		
		const isSplit = buffer.readInt32LE() === -2;
		buffer = buffer.slice(4)
		
		if(!isSplit) {
			return this.emit('packet', buffer);
		}

		const packet = parsers.multiPacketResponse(
			buffer, this
		);
		const ID = packet.ID;

		if(!this.packetsQueues[ID]) this.packetsQueues[ID] = [];

		const queue = this.packetsQueues[ID]; 
		queue.push(packet);

		if(queue.length === packet.packets.total){ 
			delete this.packetsQueues[ID];

			const orderedQueue = queue.sort(
				(p1, p2) => p1.currentPacket - p2.currentPacket
			);
			
			const bzip = orderedQueue[0].bzip;
			const finalPayload = Buffer.concat(orderedQueue.map(p => p.payload));

			if(bzip) finalPayload = decompressBZip(finalPayload, bzip);
			/*
			I never tried bzip decompression, if you are having trouble with this, contact me on discord
			Fabricio-191#8051
			*/
			

			this.emit('packet', buffer.slice(4));
		}
	}

	_ready(){
		return new Promise(resolve => {
			this.once('ready', resolve)
		})  
	}

	//----

	getInfo(){
		const start = Date.now();
		
		return new Promise((resolve, reject) => {
			this.send(constants.commands.info)
			.then(buffer => {
				const info = parsers[
					this.isGoldSource ? 'goldSourceServerInfo' : 'serverInfo'
				](buffer);
		
				Object.assign(info, {
					isGoldSource: this.isGoldSource,
					ping: Date.now() - start
				})
	
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
	
	challenge(code){
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

	static async getInfo(options){

	}

	static async getPlayers(options){

	}

	static async getRules(options){
		
	}
};

Server.prototype.ping = require('util').deprecate(Server.prototype.ping, 'Ping method is a deprecated feature of source servers');

module.exports = Server;