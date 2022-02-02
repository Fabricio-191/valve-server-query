const utils = require('../utils/utils.js');
const EventEmitter = require('events');
const dgram = require('dgram'), servers = {};

const client = dgram
	.createSocket('udp4')
	.on('message', (buffer, rinfo) => {
		if(buffer.length === 0) return;

		const address = rinfo.address + ':' + rinfo.port;

		const entry = servers[address];
		if(!entry) return;

		if(entry.options.debug) utils.debug(entry._meta ? 'SERVER' : 'MASTER_SERVER', 'recieved:', buffer);

		const packet = packetHandler(buffer, entry);
		if(!packet) return;

		entry.emit('packet', packet, address);
	})
	.unref();

function packetHandler(buffer, connection){
	if(buffer.readInt32LE() === -2){
		const { _meta, packetsQueues, options } = connection;

		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
			// only valid in the first packet
			_meta.multiPacketResponseIsGoldSource = true;
		}

		let packet;
		try{
			packet = utils.parsers.multiPacketResponse(buffer, _meta);
		}catch(e){
			if(options.debug) utils.debug('SERVER', 'cannot parse packet', buffer);
			if(connection.options.enableWarns){
				console.error(new Error('Warning: a packet couln\'t be handled'));
			}
			return;
		}
		let queue = packetsQueues[packet.ID];

		if(!queue){
			packetsQueues[packet.ID] = [packet];

			return;
		}
		queue.push(packet);

		if(queue.length !== packet.packets.total) return;

		if(_meta.multiPacketResponseIsGoldSource && queue.some(p => !p.goldSource)){
			queue = queue.map(p => utils.parsers.multiPacketResponse(p.raw, _meta));
		}

		queue = queue
			.sort((p1, p2) => p1.packets.current - p2.packets.current)
			.map(p => p.payload);

		delete packetsQueues[packet.ID];

		buffer = Buffer.concat(queue);

		if(queue[0].bzip){
			if(options.debug) utils.debug('SERVER', `BZip ${connection.ip}:${connection.port}`, buffer);
			buffer = utils.decompressBZip(buffer);
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

class Connection extends EventEmitter{
	constructor(options, _meta){
		super();
		this.options = options;
		this._meta = _meta;

		this.address = options.ip + ':' + options.port;
		servers[this.address] = this;

		client.setMaxListeners(client.getMaxListeners() + 20);
	}
	address = null;
	options = {};

	_meta = null;
	packetsQueues = {};
	lastPing = -1;

	send(command){
		if(this.options.debug) utils.debug(this._meta ? 'SERVER' : 'MASTER_SERVER', 'sent:', command);

		return new Promise((res, rej) => {
			client.send(
				Buffer.from(command),
				this.options.port,
				this.options.ip,
				err => {
					if(err) return rej(err);
					res();
				},
			);
		});
	}

	awaitResponse(responseHeaders){
		return new Promise((res, rej) => {
			// eslint-disable-next-line prefer-const
			let clear;

			const onError = err => { clear(); rej(err); };
			const onPacket = (buffer, address) => {
				if(
					this.address !== address ||
					!responseHeaders.includes(buffer[0])
				) return;

				clear(); res(buffer);
			};

			const timeout = setTimeout(onError, this.options.timeout, new Error('Response timeout.'));

			this.on('packet', onPacket);
			client.on('error', onError);

			clear = () => {
				this.off('packet', onPacket);
				client.off('error', onError);
				clearTimeout(timeout);
			};
		});
	}

	async query(command, ...responseHeaders){
		await this.send(command);

		const timeout = setTimeout(() => {
			this.send(command).catch(() => {});
		}, this.options.timeout / 2);

		const start = Date.now();
		return await this.awaitResponse(responseHeaders)
			.then(value => {
				this.lastPing = Date.now() - start;
				return value;
			})
			.finally(() => clearTimeout(timeout));
	}

	destroy(){
		client.setMaxListeners(client.getMaxListeners() - 20);
		delete servers[this.options.ip+':'+this.options.port];
	}
}

module.exports = async function createConnection(data, _meta){
	data = await utils.parseOptions(data, !_meta);

	return new Connection(data, _meta);
};