const client = require('./connectionManager.js');
const EventEmitter = require('events');
const { constants, parsers, decompressBZip } = require('../utils/utils.js');

class Connection extends EventEmitter{
    constructor(options){
		super();
		
		client.createConnection(
			options, 
			this.packetHandler.bind(this), 
			(info, options) => {
				Object.assign(this, options, {
					protocol: info.protocol,
					appID: info.appID,
					ready: true
				});
				

				this.emit('ready');
			}
		)
    }
	timeout = 3000;

	ip = null
	port = null

	ready = false;

	appID = null
	protocol = null;

	async send(command, bypass = false){
		if(this.ip instanceof Promise) await this.ip;
		if(!this.ready && !bypass) await this._ready();

		this.queue.push(command);
		if(queue.length > 1){
			await this._next();
		}

		if(this.debug) console.log('\nsent:    ', Buffer.from(command));
		client.send(Buffer.from(command), this.port, this.ip, err => {
			if(err) reject(err);
		});
	}

	queue = [];
	async awaitResponse(code){
		const responseHeaders = constants.responsesHeaders[
			code
		];
		
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
	}

	packetsQueues = {};
	packetHandler(buffer){
		if(buffer.readInt32LE() === -2){
			const packet = parsers.multiPacketResponse(
				buffer, this
			);
			const ID = packet.ID, queue = this.packetsQueues[ID]; 
	
			if(!queue){
				setTimeout(() => {
					delete this.packetsQueues[ID];
				}, this.timeout * 2)

				return this.packetsQueues[ID] = [packet];
			};
	
			queue.push(packet);
	
			if(queue.length !== packet.packets.total) return;
			
			const orderedQueue = queue.sort(
				(p1, p2) => p1.packets.current - p2.packets.current
			);

			if(
				queue[0].isGoldSource && 
				queue.some(packet => packet.isGoldSource === false)
			){
				//not tested
				queue = queue.map(packet => parsers.multiPacketResponse(
					packet.raw, this
				))
			}
				
			buffer = Buffer.concat(
				orderedQueue.map(p => p.payload)
			);
	
			if(orderedQueue[0].bzip) buffer = decompressBZip(finalPayload);
			/*
			I never tried bzip decompression, if you are having trouble with this, contact me on discord
			Fabricio-191#8051, and please send me de ip and port of the server, so i can do tests
			*/
		}

		this.emit('packet', buffer.slice(4));
	}

	_next(){
		return new Promise(resolve => {
			this.once('next', resolve)
		})  
	}

	_ready(){
		return new Promise(resolve => {
			this.once('ready', resolve)
		})  

		
	}
}

module.exports = Connection;
module.exports.client = client;
