const client = require('dgram').createSocket('udp4');
const { EventEmitter } = require('events');
const { parsers, decompressBZip } = require('../utils/utils.js');
const servers = {};

client.on('message', (buffer, rinfo) => {
	if(buffer.length === 0) return;

	let entry = servers[rinfo.address+':'+rinfo.port];
	if(!entry) return;

	let packet = packetHandler(buffer, entry.server);
	if(!packet) return;

	try{
		entry.callback(packet);
	}catch(e){
		console.error('Connection Mananger', e);
	}
});

function packetHandler(buffer, server){
	if(server.options.debug)  console.log('\nRecieved:    ', `<Buffer ${buffer.toString('hex').match(/../g).join(' ')}>`);
	if(buffer.readInt32LE() === -2){
		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
			//only valid in the first packet
			server._info[1] = true;  //multiPacketResponseIsGoldSource
		}

		const { packetsQueues } = servers[server.ip+':'+server.port];

		let packet;
		try{
			packet = parsers.multiPacketResponse(
				buffer, server
			);
		}catch(e){
			server._info[1] = true;
			packet = parsers.multiPacketResponse(
				buffer, server
			);
		}
		let queue = packetsQueues[packet.ID]; 

		if(!queue){
			setTimeout(() => {
				delete packetsQueues[packet.ID];
			}, server.options.timeout * 2);

			return packetsQueues[packet.ID] = [packet];
		}else queue.push(packet);

		if(queue.length !== packet.packets.total) return;
        
		if(server._info[1] && queue.some(p => !p.goldSource)){
			queue = queue.map(p => parsers.multiPacketResponse(
				p.raw, server
			));
		}
            
		buffer = Buffer.concat(
			queue.sort(
				(p1, p2) => p1.packets.current - p2.packets.current
			).map(p => p.payload)
		);

		if(queue[0].bzip){
			//console.log('BZip', server.ip+':'+server.port, `<Buffer ${buffer.toString('hex').match(/../g).join(' ')}>`)
			buffer = decompressBZip(buffer);
		}
		/*
        I never tried bzip decompression, if you are having trouble with this, contact me on discord
        Fabricio-191#8051, and please send me de ip and port of the server, so i can do tests
        */
	}

	return buffer.slice(4);
}

class Connection extends EventEmitter{
	constructor(server){
		super();
		
		Object.assign(this, {
			ip: server.ip,
			port: server.port,
			server
		});

		(async () => {
			if(this.ip instanceof Promise){
				this.ip = await this.ip;
			}
			this.ready = true;
			this.emit('ready');

			servers[this.ip+':'+this.port] = {
				server,
				packetsQueues: {},
				callback: this.emit.bind(this, 'packet')
			};
		})();
	}
	ip = null;
	port = null;
	ready = false;

	server = null;

	async send(command){
		if(!this.ready) await this._ready();
		
		if(this.server.options.debug) console.log('\nSent:    ', Buffer.from(command));
		client.send(Buffer.from(command), this.port, this.ip, err => {
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
			}, this.server.options.timeout);
				
			const handler = buffer => {
				if(!packetHeaders.includes(buffer[0])) return;

				this.off('packet', handler);
				clearTimeout(timeout);

				resolve(buffer);
			};
							
			this.on('packet', handler);
		});
	}
		
	_ready(){
		return new Promise(resolve => {
			this.once('ready', resolve);
		});  
	}

	destroy(){
		delete servers[this.server.ip+':'+this.server.port];
	}
}

module.exports = {
	Connection,
	servers, 
	client
};