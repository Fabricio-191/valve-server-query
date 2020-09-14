const    DGRAM = require('dgram'), 
  EventEmitter = require('events'),
       parsers = require('./utils/parsers.js'), 
     constants = require('./utils/constants.json'),
decompressBZip = require('./utils/Bzip2.js');

const client = DGRAM.createSocket('udp4');
	 
class Connection extends EventEmitter{
	constructor(options = {}){
		super();
		
		client.on('message', this.packetHandler.bind(this))
		if(options.debug){
			client.on('message', (buffer, rinfo) => console.log('received:', buffer));
			this.debug = true;
		}

		let { timeout, ip, address, port } = options;
		let server = {
			ip: ip || address,
			port: Number(port) || 27015,
			timeout
		}

		if(!server.ip){
			throw Error('You should put the IP for the server to connect')
		}else if(typeof server.ip !== 'string'){
			throw Error('The ip to connect should be a string')
		}else if(!server.port && server.port !== 0){
			throw Error('You should put the port for the server to connect')
		}else if(
			typeof server.port !== 'number' || 
			server.port > 65535 || server.port < 0
		){
			throw Error('The port to connect should be a number between 0 and 65535')
		}else if(timeout && typeof timeout !== 'number'){
			return Error('The timeout should be a number');
		}
		
		Object.assign(this, server)

		const timeout = setTimeout(() => {
			throw Error('Can not connect to the server.');
		}, this.timeoutTime * 2)

		this.send(constants.commands.info, true)
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
		.catch(e => {})
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
	
	async challenge(code){
		const command = constants.commands.challenge;
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

	_ready(){
		return new Promise(resolve => {
			this.once('ready', resolve)
		})  
	}
}

module.exports = Connection;