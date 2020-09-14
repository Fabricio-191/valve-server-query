const    DGRAM = require('dgram'), 
  EventEmitter = require('events'),
         utils = require('util'),
     constants = require('./utils/constants.json'), 
	   parsers = require('./utils/parsers.js'), 
decompressBZip = require('./utils/Bzip2.js');

const connectionSymbol = Symbol('connection');
const client = DGRAM.createSocket('udp4');
	 
class Connection extends EventEmitter{
	constructor(options){
		super();
		
		client.on('message', this.packetHandler.bind(this))
		if(options.debug){
			client.on('message', (buffer, rinfo) => console.log('received:', buffer));
			this.debug = true;
		}

		let { timeoutTime, server, port } = options;
		
		if(timeoutTime && typeof timeoutTime !== 'number'){
			return Error('The timeout should be a number');
		}

		if(typeof server === 'string' && server.includes(':')){
			const [ip, port] = server.trim().split(':');
			server = { ip, port };
		}else{
			server = {
				ip: server.ip || server.address || server,
				port: Number(port) || 27015
			}
		}

		if(!server.ip) throw Error('You should put the IP for the server to connect')
		if(!server.port) throw Error('You should put the port for the server to connect')
		if(typeof server.ip !== 'string') throw Error('The ip to connect should be a string')
		if(
			typeof server.port !== 'number' || 
			server.port > 65535 || server.port < 0
		) throw Error('The port to connect should be a number between 0 and 65535')

		Object.assign(this, server)

		const timeout = setTimeout(() => {
			throw Error('Can not connect to the server.');
		}, this.timeoutTime * 2)

		this.send(constants.commands.info, true)
		.catch(e => { 
			throw e.message
		})
		.then(buffer => {
			this.isGoldSource = buffer[0] === 0x6D;

			let info = parsers[
				this.isGoldSource ? 'goldSourceServerInfo' : 'serverInfo'
			](buffer)

			Object.assign(this, {
				protocol: info.protocol,
				appID: info.appID
			})
			clearTimeout(timeout)
			
			this.ready = true;
			this.emit('ready');
		})
	}
	ready = false;

	ip = null
	port = 27015

	protocol = null;
	appID = null;
	isGoldSource = false;

	timeoutTime = 3000;

	send(command, bypass = false){
		return new Promise(async (resolve, reject) => {
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
			}, this.timeoutTime);
					
			const handler = buffer => {
				if(!responseHeaders.includes(buffer[0])) return;
	
				this.removeListener('packet', handler);
				clearTimeout(timeout);
				
				resolve(buffer)
			};
					
			this.addListener('packet', handler);
		})
	}

	packetsQueues = {};
	packetHandler(buffer, rinfo){
		if(
			rinfo.address !== this.ip || 
			rinfo.port !== this.port || 
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
			

			this.emit('packet', finalPayload.slice(4));
		}
	}

	_ready(){
		return new Promise(resolve => {
			this.once('ready', resolve)
		})  
	}
}

class Server{
	constructor(options = {}) {
		Object.defineProperty(this, connectionSymbol, {
			value: new Connection(
				Object.assign({}, options, { 
					port: 27015,
					timeoutTime: 3000,
					debug: false
				})
			), 
			enumerable: false
		})
	}
	[connectionSymbol] = null;

	async getInfo(){
		const start = Date.now();
		const buffer = await this.send(constants.commands.info)
		.catch(err => { throw err });

		const info = parsers[
			this.isGoldSource ? 'goldSourceServerInfo' : 'serverInfo'
		](buffer);

		info.isGoldSource = this.isGoldSource;
		info.ping = Date.now() - start;	
		return info;
	}

	async getPlayers(){
		const key = await this.challenge(0x55)
		.catch(err => { throw err });

		const command = constants.commands.players.concat(...key.slice(1));

		const buffer = await this.send(command)
		.catch(err => { throw err });

		if(Buffer.compare(buffer, Buffer.from(key)) === 0){
			throw Error('Wrong server response')
		}

		return parsers.playersInfo(buffer);
	}

	async getRules(){
		const key = await this.challenge(0x56)
		.catch(err => { throw err });

		if(key[0] === 0x45 && key.length > 5){
			return parsers.serverRules(Buffer.from(key));
		}

		const command = constants.commands.rules.concat(...key.slice(1));
        
		const buffer = await this.send(command)
		.catch(err => { throw err });

		if(Buffer.compare(buffer, Buffer.from(key)) === 0){
			throw Error('Wrong server response')
		}

		return parsers.serverRules(buffer);
	}

	async challenge(code){
		const command = constants.commands.challenge;
		if(
			!constants.apps_IDs.challenge.includes(this.appID)
		){
			command[4] = code;
		}
		
		const buffer = await this.send(command)
		.catch(err => { throw err });

		return Array.from(buffer);
	}

	async getAll(){
		const [info, players, rules] = await Promise.all([
			this.getInfo(),
			this.getPlayers(),
			this.getRules()
		]).catch(err => { throw err })

		info.players.list = players;
		info.rules = rules;

		return info;
	}
	
	async ping(){
        const start = Date.now();
        
        await this.send(constants.commands.ping)
		.catch(err => { throw err });

		return Date.now() - start;
	}
};

Server.prototype.ping = utils.deprecate(Server.prototype.ping, 'Ping method is a deprecated feature of source servers');

module.exports = Server;