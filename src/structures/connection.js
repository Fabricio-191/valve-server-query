const client = require('dgram').createSocket('udp4');
const EventEmitter = require('events');
const { constants, parsers, decompressBZip } = require('../utils/utils.js');
const servers = {};

client.on('message', (buffer, rinfo) => {
	if(buffer.length === 0) return;

    let callback = servers[rinfo.address+':'+rinfo.port];
    if(callback) callback(buffer);
});

client.createConnection = async function(options, onMessage, onReady){
    if(options.ip instanceof Promise){
        options.ip = await options.ip;
    }
    let key = options.ip+':'+options.port;
	
	client.send(Buffer.from(constants.commands.info), options.port, options.ip, err => {
		if(err) throw err;
	})

	let responses = []

    setTimeout(() => {
		if(responses.length){
			servers[key] = onMessage;
			return onReady(Object.assign({}, ...responses), options);
		}else{
			throw Error('Can not connect to the server.');
		}
	}, options.timeout * 2)
	
    servers[key] = buffer => {
        if(buffer.readInt32LE() === -2){
            throw Error('I need to handle this somehow');
        }else{
			if(![0x49, 0x6d].includes(buffer[4])) return;
			
            responses.push(
				parsers.serverInfo(buffer.slice(4))
			);
        }
    }

    return () => {
        delete servers[key];
    };
}

class Connection extends EventEmitter{
    constructor(options){
		super();
		
		client.createConnection(options, this.packetHandler.bind(this), (info, options) => {
			Object.assign(this, options, {
				protocol: info.protocol,
				appID: info.appID,
				ready: true,
				isGoldSource: info.isGoldSource || false
			});

			this.emit('ready');
		})
    }
	timeout = 3000;

	ip = null
	port = null

	ready = false;

	appID = null
	protocol = null;

	async send(command, reject){
		if(this.ip instanceof Promise) await this.ip;
		if(!this.ready) await this._ready();

		if(this.debug) console.log('\nSent:    ', Buffer.from(command));
		client.send(Buffer.from(command), this.port, this.ip, err => {
			if(err) reject(err);
		});
	}

	awaitResponse(...responseHeaders){
		return new Promise((resolve, reject) => {
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
	packetHandler(buffer){
		if(this.debug){
			console.log('\nRecieved:    ', buffer.toString('hex').match(/../g).join(' '));
		}

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
			}else queue.push(packet);
	
			if(queue.length !== packet.packets.total) return;
			const orderedQueue = queue.sort(
				(p1, p2) => p1.packets.current - p2.packets.current
			);
				
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

	_ready(){
		return new Promise(resolve => {
			this.once('ready', resolve)
		})  

		
	}
}

module.exports = Connection;
module.exports.client = client;