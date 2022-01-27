const { parsers, decompressBZip, debug, parseOptions } = require('../utils/utils.js');
const dgram = require('dgram'), servers = {};

const clients = {
	udp4: dgram
		.createSocket('udp4')
		.on('message', onMessage)
		.unref(),
	_udp6: null,
	get udp6(){
		if(!this._udp6){
			this._udp6 = dgram
				.createSocket('udp6')
				.on('message', onMessage)
				.unref();
		}

		return this._udp6;
	},
};

function onMessage(buffer, rinfo){
	if(buffer.length === 0) return;

	const entry = servers[rinfo.address+':'+rinfo.port];
	if(!entry) return;
	if(entry.options.debug) debug(entry.type, 'recieved:', buffer);

	const packet = packetHandler(buffer, entry);
	if(!packet) return;

	entry.client.emit('packet', packet);
}

function packetHandler(buffer, connection){
	if(buffer.readInt32LE() === -2){
		const { _meta, packetsQueues, options } = connection;

		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
			// only valid in the first packet
			_meta.multiPacketResponseIsGoldSource = true;
		}

		let packet;
		try{
			packet = parsers.multiPacketResponse(buffer, _meta);
		}catch(e){
			if(options.debug) debug('SERVER', 'cannot parse packet', buffer);
			throw new Error('Cannot parse packet');
		}
		let queue = packetsQueues[packet.ID];

		if(!queue){
			packetsQueues[packet.ID] = [packet];

			return;
		}
		queue.push(packet);

		if(queue.length !== packet.packets.total) return;

		if(_meta.multiPacketResponseIsGoldSource && queue.some(p => !p.goldSource)){
			queue = queue.map(p => parsers.multiPacketResponse(p.raw, _meta));
		}

		queue = queue
			.sort((p1, p2) => p1.packets.current - p2.packets.current)
			.map(p => p.payload);

		delete packetsQueues[packet.ID];

		buffer = Buffer.concat(queue);

		if(queue[0].bzip){
			if(options.debug) debug('SERVER', `BZip ${connection.ip}:${connection.port}`, buffer);
			buffer = decompressBZip(buffer);
		}
		/*
		I never tried bzip decompression, if you are having trouble with this, contact me on discord
		Fabricio-191#8051, and please send me de ip and port of the server, so i can do tests
		*/
	}

	if(buffer.readInt32LE() === -1) return buffer.slice(4);

	if(connection.options.enableWarns){
		console.error(new Error('Warning: a packet couln\'t be handled'));
	}
}

class Connection{
	constructor(data, _meta){
		Object.assign(this, data, {
			_meta,
			client: clients[data.protocol],
		});

		servers[this.ip+':'+this.port] = this;

		this.client.setMaxListeners(this.client.getMaxListeners() + 20);
		if(!_meta) this.type = 'MASTER_SERVER';
	}
	type = 'SERVER';
	client = null;

	protocol = 'udp4';
	ip = null;
	port = null;

	options = {
		debug: false,
		timeout: 2000,
		retries: 3,
		enableWarns: true,
	}

	_meta = {};
	packetsQueues = {};

	send(command){
		if(this.options.debug) debug(this.type, 'sent:', command);

		return new Promise((res, rej) => {
			this.client.on('error', rej);

			this.client
				.send(Buffer.from(command), this.port, this.ip, err => {
					this.client.off('error', rej);
					if(err) return rej(err);
					res();
				});
		});
	}

	awaitResponse(...responseHeaders){
		const err = new Error('Response timeout.');

		return new Promise((res, rej) => {
			const handler = packet => {
				if(!responseHeaders.includes(packet[0])) return;

				// eslint-disable-next-line no-use-before-define
				clearTimeout(timeout); clear();

				res(packet);
			};

			const clear = this._addEvents(
				'packet', handler,
				'error', rej,
			);

			const timeout = setTimeout(() => {
				clear(); rej(err);
			}, this.options.timeout);
		});
	}

	query(command, ...responseHeaders){
		const time = this.options.timeout * 0.9 / this.options.retries;

		return new Promise((res, rej) => {
			const interval = setInterval(() => {
				this.send(command).catch(rej);
			}, time);

			this.awaitResponse(...responseHeaders)
				.then(res)
				.catch(rej)
				.finally(() => {
					clearInterval(interval);
				});
		});
	}

	destroy(){
		this.client.setMaxListeners(this.client.getMaxListeners() - 20);
		delete servers[this.ip+':'+this.port];
	}

	_addEvents(...args){
		for(let i = 0; i < args.length; i += 2){
			const event = args[i], listener = args[i + 1];

			this.client.on(event, listener);
		}

		return () => {
			for(let i = 0; i < args.length; i += 2){
				const event = args[i], listener = args[i + 1];

				this.client.off(event, listener);
			}
		};
	}
}

module.exports = async function createConnection(data, _meta){
	data = await parseOptions(data, _meta ? 'SERVER' : 'MASTER_SERVER');

	return new Connection(data, _meta);
};