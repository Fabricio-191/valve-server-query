const dns = require('dns'), net = require('net');
const MASTER_SERVER_REGION_CODES = {
		US_EAST: 0,
		US_WEST: 1,
		SOUTH_AMERICA: 2,
		EUROPE: 3,
		ASIA: 4,
		AUSTRALIA: 5,
		MIDDLE_EAST: 6,
		AFRICA: 7,
		OTHER: 255,
	}, DEFAULT_OPTIONS = {
		timeout: 2000,
		debug: false,
		enableWarns: true,
		retries: 3,
	};


class BufferWriter{
	buffer = [];

	string(value, encoding){
		return this.byte(
			...Buffer.from(value, encoding), 0,
		);
	}

	byte(...values){
		this.buffer.push(...values);

		return this;
	}

	long(number){
		const buf = Buffer.alloc(4);
		buf.writeInt32LE(number);

		return this.byte(...buf);
	}

	end(){
		return Buffer.from(this.buffer);
	}
}

module.exports = {
	BufferWriter,
	parsers: require('./parsers.js'),

	decompressBZip: require('./Bzip2.js'),
	debug,

	parseOptions,
	resolveHostname,
};

// eslint-disable-next-line complexity
async function parseOptions(data = {}, type = 'SERVER'){
	if(typeof data !== 'object'){
		throw Error("'data' must be an object");
	}

	const DEFAULT_DATA = type === 'MASTER_SERVER' ?
		{ ip: 'hl2master.steampowered.com', port: 27011 } :
		{ ip: 'localhost', port: 27015 };

	data = Object.assign({}, DEFAULT_DATA, data);
	if(typeof data.ip !== 'string'){
		throw Error("'data.ip' must be a string");
	}else if(net.isIP(data.ip) === 0){
		[data.ip] = await resolveHostname(data.ip);
	}

	const ipFormat = net.isIP(data.ip);
	if(ipFormat === 0){
		throw Error('Invalid IP/Hostname');
	}

	data.port = parseInt(data.port);
	data.protocol = `udp${ipFormat}`;
	data.options = Object.assign({}, DEFAULT_OPTIONS, data.options);

	if(isNaN(data.port) || data.port < 0 || data.port > 65535){
		throw Error('The port to connect should be a number between 0 and 65535');
	}

	if(type === 'RCON'){
		if(!('password' in data)){
			throw Error('You must introduce the RCON password');
		}else if(typeof data.password !== 'string'){
			throw Error('RCON password must be a string');
		}
	}else if(type === 'MASTER_SERVER'){
		if(!('region' in data)) data.region = 'OTHER';
		if(!('quantity' in data)) data.quantity = 200;
		else if(data.quantity === 'all') data.quantity = Infinity;

		if(isNaN(data.quantity) && data.quantity <= 0){
			throw Error("'quantity' must be a number greater than zero");
		}else if(data.region in MASTER_SERVER_REGION_CODES){
			data.region = MASTER_SERVER_REGION_CODES[data.region];
		}else{
			throw Error('The specified region is not valid');
		}
	}

	if(typeof data.options.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof data.options.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(isNaN(data.options.timeout) || data.options.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}else if(isNaN(data.options.retries) || data.options.retries < 0){
		throw Error("'retries' should be a number greater than zero");
	}

	return data;
}

function resolveHostname(hostname){
	const err = new Error('Invalid IP/Hostname');

	return new Promise((res, rej) => {
		dns.resolve(hostname, (_err, addresses) => {
			if(_err) return rej(err);

			res(addresses);
		});
	});
}

function debug(type, string, buffer){
	string = `\x1B[33m${type} ${string}\x1B[0m`;
	if(buffer){
		console.log(string, `<Buffer ${
			Buffer.from(buffer)
				.toString('hex')
				.match(/../g)
				.join(' ')
		}>`, '\n');
	}else{
		console.log(string, '\n');
	}
}