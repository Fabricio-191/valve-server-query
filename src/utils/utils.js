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
		quantity: 200,
		region: 'OTHER',
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

	parseData,
	resolveHostname,
};

async function parseData(data, type){
	if(typeof data !== 'object'){
		throw Error("'data' must be an object");
	}

	const DEFAULT_DATA = type === 'MASTER_SERVER' ?
		{ ip: 'hl2master.steampowered.com', port: 27011 } :
		{ ip: 'localhost', port: 27015 };

	data = Object.assign(DEFAULT_DATA, data);

	if(typeof data.ip !== 'string'){
		throw Error('The ip to connect should be a string');
	}else if(net.isIP(data.ip) === 0){
		[data.ip] = await resolveHostname(data.ip);
	}

	const ipFormat = net.isIP(data.ip);

	const parsedData = {
		ip: data.ip,
		port: parseInt(data.port, 10),
		options: parseOptions(data, type),
		protocol: type === 'RCON' ? 'tcp' : `udp${ipFormat}`,
	};

	if(!parsedData.ip || ipFormat === 0){
		throw Error('Invalid IP/Hostname');
	}else if(isNaN(parsedData.port) || parsedData.port < 0 || parsedData.port > 65535){
		throw Error('The port to connect should be a number between 0 and 65535');
	}

	if(type === 'RCON'){
		if(!data.password){
			throw Error('You must introduce the RCON password');
		}else if(data.password === ''){
			throw Error('RCON password cannot be an empty string');
		}else if(typeof data.password !== 'string'){
			throw Error('RCON password must be a string');
		}

		parsedData.password = data.password;
	}

	return parsedData;
}

function parseOptions(data, type){
	if(!data.options) data.options = {};
	const parsedOptions = {};

	Object.keys(DEFAULT_OPTIONS)
		.forEach(key => {
			parsedOptions[key] = data.options[key] || data[key] || DEFAULT_OPTIONS[key];
		});

	// @ts-ignore
	if(parsedOptions.quantity === 'all') parsedOptions.quantity = Infinity;
	if(typeof parsedOptions.region === 'string'){
		parsedOptions.region = MASTER_SERVER_REGION_CODES[parsedOptions.region];
	}

	if(typeof parsedOptions.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof parsedOptions.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(isNaN(parsedOptions.timeout) || parsedOptions.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}else if(isNaN(parsedOptions.retries) || parsedOptions.retries < 0){
		throw Error("'retries' should be a number greater than zero");
	}else if(isNaN(parsedOptions.quantity) && parsedOptions.quantity <= 0){
		throw Error("'quantity' must be a number greater than zero");
	}else if(!Object.values(MASTER_SERVER_REGION_CODES).includes(parsedOptions.region)){
		throw Error('The specified region is not valid');
	}

	if(type !== 'MASTER_SERVER'){
		delete parsedOptions.quantity;
		delete parsedOptions.region;
	}

	return parsedOptions;
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

	if(buffer && buffer.length < 1000){
		buffer = `<Buffer ${
			Buffer.from(buffer)
				.toString('hex')
				.match(/../g)
				.join(' ')
		}>`;
	}

	console.log(string, buffer || '', '\n');
}