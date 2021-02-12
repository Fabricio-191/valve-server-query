const { parsers, decompressBZip, debug, parseOptions } = require('../utils/utils.js');
const dgram = require('dgram'), servers = {};

const clients = {
	_udp4: null,
	get udp4(){
		if(!this._udp4){
			this._udp4 = dgram.createSocket('udp4').on('message', onMessage);
		}

		return this._udp4;
	},
	_udp6: null,
	get udp6(){
		if(!this._udp6){
			this._udp6 = dgram.createSocket('udp6').on('message', onMessage);
		}

		return this._udp6;
	},
};

function onMessage(buffer, rinfo){
	if(buffer.length === 0) return;

	const entry = servers[rinfo.address+':'+rinfo.port];
	if(!entry) return;
	if(entry.debug) debug('recieved:', buffer);

	const packet = packetHandler(buffer, entry);
	if(!packet) return;

	entry._callbacks.map(fn => fn(packet));
}

function packetHandler(buffer, connection){
	if(buffer.readInt32LE() === -2){
		const { server: { _meta }, packetsQueues, timeout } = connection;

		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
			// only valid in the first packet
			_meta.multiPacketResponseIsGoldSource = true;
		}

		let packet;
		try{
			packet = parsers.multiPacketResponse(
				buffer, _meta
			);
		}catch(e){
			if(connection.debug){
				debug('cannot parse packet', buffer);
			}
			throw new Error('Cannot parse packet');
		}
		let queue = packetsQueues[packet.ID];

		if(!queue){
			packetsQueues[packet.ID] = [packet];

			setTimeout(() => {
				delete packetsQueues[packet.ID];
			}, timeout * 2);

			return;
		}
		queue.push(packet);

		if(queue.length !== packet.packets.total) return;

		if(_meta.multiPacketResponseIsGoldSource && queue.some(p => !p.goldSource)){
			queue = queue.map(p => parsers.multiPacketResponse(
				p.raw, _meta
			));
		}

		buffer = Buffer.concat(
			queue.sort(
				(p1, p2) => p1.packets.current - p2.packets.current
			).map(p => p.payload)
		);

		if(queue[0].bzip){
			if(connection.debug) debug(`BZip ${connection.ip}:${connection.port}`, buffer);
			buffer = decompressBZip(buffer);
		}
		/*
		I never tried bzip decompression, if you are having trouble with this, contact me on discord
		Fabricio-191#8051, and please send me de ip and port of the server, so i can do tests
		*/
	}

	if(buffer.readInt32LE() === -1) return buffer.slice(4);

	throw new Error('cannot handle packet');
}

class Connection{
	constructor(options, server = null){
		Object.assign(this, options);

		this.server = server;
		servers[this.ip+':'+this.port] = this;
	}
	ip = null;
	port = null;
	timeout = 2000;
	debug = false;

	server = null;
	packetsQueues = {};

	protocol = 4;
	send(command){
		if(this.debug) debug('sent:', command);
		return new Promise((res, rej) => {
			clients['udp' + this.protocol]
				.send(Buffer.from(command), this.port, this.ip, err => {
					if(err) return rej(err);
					res();
				});
		});
	}

	_callbacks = [];
	_rmCallback(handler){
		this._callbacks.splice(
			this._callbacks.indexOf(handler), 1
		);
	}

	awaitPacket(packetHeaders){
		return new Promise((res, rej) => {
			const handler = buffer => {
				if(!packetHeaders.includes(buffer[0])) return;

				this._rmCallback(handler);
				// eslint-disable-next-line no-use-before-define
				clearTimeout(timeout);

				res(buffer);
			};

			const timeout = setTimeout(() => {
				this._rmCallback(handler);
				rej(new Error('Response timeout.'));
			}, this.timeout);

			this._callbacks.push(handler);
		});
	}

	async query(command, ...responseHeaders){
		const response = this.awaitPacket(responseHeaders)
			.then(() => { response.fullfilled = true; });

		while(!response.fullfilled){
			await this.send(command);

			await delay(this.timeout / this.retries);
		}

		return await response;
	}

	destroy(){
		delete servers[this.ip+':'+this.port];
	}

	static async init(options, server){
		return new Connection(
			await parseOptions(options), server
		);
	}
}

module.exports = {
	Connection,
	servers,
	clients,
};

function delay(timeout){
	return new Promise(res => {
		setTimeout(res, timeout);
	});
}