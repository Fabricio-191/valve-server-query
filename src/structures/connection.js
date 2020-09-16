const client = require('dgram').createSocket('udp4');
const EventEmitter = require('events');
const { constants, parsers, decompressBZip } = require('./utils/utils.js');

class Connection extends EventEmitter{
    constructor(options){
		client.on('message', this.packetHandler.bind(this))
		
		Object.assign(this, options)

		if(options.debug){
			console.log('https://developer.valvesoftware.com/wiki/Server_queries')
			client.on('message', (buffer, rinfo) => console.log('received:', buffer));
			this.debug = true;
		}
		
		let timeout = setTimeout(() => {
			throw Error('Can not connect to the server.');
		}, this.timeout * 2)

		this.send(constants.commands.info, true)
		.then(buffer => {
			let info = parsers.serverInfo(buffer)

			Object.assign(this, {
				protocol: info.protocol,
				appID: info.appID,
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
				this.off('packet', handler);
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
		
		
		if(buffer.readInt32LE() === -2){ //is split
			const packet = parsers.multiPacketResponse(
				buffer, this
			);
			const ID = packet.ID;
	
			if(!this.packetsQueues[ID]) this.packetsQueues[ID] = [];
	
			const queue = this.packetsQueues[ID]; 
			queue.push(packet);
	
			if(queue.length !== packet.packets.total) return;

			delete this.packetsQueues[ID];
	
			const orderedQueue = queue.sort(
				(p1, p2) => p1.currentPacket - p2.currentPacket
			);
				
			const bzip = orderedQueue[0].bzip;
			buffer = Buffer.concat(orderedQueue.map(p => p.payload));
	
			if(bzip) buffer = decompressBZip(finalPayload, bzip);
			/*
			I never tried bzip decompression, if you are having trouble with this, contact me on discord
			Fabricio-191#8051
			*/
		}

		this.emit('packet', buffer.slice(4));
	}

	_ready(){
		return new Promise(resolve => {
			this.once('ready', resolve)
		})  
	}
}

module.exports = Connection;