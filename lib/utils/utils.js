const dns = require('dns'), net = require('net');
const DEFAULT_OPTIONS = {
	ip: 'localhost',
	port: 27015,
	timeout: 5000,
	debug: false,
	enableWarns: true,
};
const MASTER_SERVER = {
	REGIONS: {
		US_EAST: 0,
		US_WEST: 1,
		SOUTH_AMERICA: 2,
		EUROPE: 3,
		ASIA: 4,
		AUSTRALIA: 5,
		MIDDLE_EAST: 6,
		AFRICA: 7,
		OTHER: 255,
	},
	DEFAULT_OPTIONS: Object.assign({}, DEFAULT_OPTIONS, {
		ip: 'hl2master.steampowered.com',
		port: 27011,
		quantity: 200,
		region: 'OTHER',
	}),
};

async function checkIP(str){
	if(typeof str !== 'string'){
		throw Error("'options.ip' must be a string");
	}else if(net.isIP(str) === 0){
		[str] = await resolveHostname(str);
	}

	const ipFormat = net.isIP(str);
	if(ipFormat === 0){
		throw Error('Invalid IP/Hostname');
	}else if(ipFormat === 6){
		console.log('IPv6 is easy to support, but i decided to not support it for now, cause i have never seen an ipv6 server');
		console.log('If you need it, you can create an issue on github');
		throw new Error('IPv6 is not supported');
	}

	return str;
}

async function parseOptions(options = {}, isMasterServer = false){
	if(typeof options !== 'object'){
		throw Error("'options' must be an object");
	}

	if(isMasterServer){
		options = Object.assign({}, MASTER_SERVER.DEFAULT_OPTIONS, options);

		if(options.quantity === 'all') options.quantity = Infinity;

		if(typeof options.quantity !== 'number' || isNaN(options.quantity) || options.quantity <= 0){
			throw Error("'quantity' must be a number greater than zero");
		}else if(options.region in MASTER_SERVER.REGIONS){
			options.region = MASTER_SERVER.REGIONS[options.region];
		}else{
			throw Error('The specified region is not valid');
		}
	}else{
		options = Object.assign({}, DEFAULT_OPTIONS, options);
	}

	if(
		typeof options.port !== 'number' || isNaN(options.port) ||
		options.port < 0 || options.port > 65535
	){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof options.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof options.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(isNaN(options.timeout) || options.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}

	options.ip = await checkIP(options.ip);

	return options;
}

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

function resolveHostname(hostname){
	const err = new Error('Invalid IP/Hostname');

	return new Promise((res, rej) => {
		dns.resolve(hostname, (_err, addresses) => {
			if(_err) return rej(err);

			res(addresses);
		});
	});
}

function debug(type, string, thing){
	string = `\x1B[33m${type} ${string}\x1B[0m`;
	if(thing instanceof Buffer){
		const parts = Buffer.from(thing)
			.toString('hex')
			.match(/../g);

		for(let i = 0; i < parts.length; i++){
			if(
				parts[i - 1] !== '00' &&
				parts[i + 0] === '00' &&
				parts[i + 1] === '00' &&
				parts[i + 2] !== '00'
			){
				parts[i] = '\x1B[31m00';
				parts[++i] = '00\x1B[0m';
			}
		}

		if(thing.length > 30){
			console.log(string, `<Buffer ${
				parts.slice(0, 20).join(' ')
			} ...${thing.length - 20} bytes>`, '\n');
		}else{
			console.log(string, `<Buffer ${
				parts.join(' ')
			}>`, '\n');
		}
	}else if(thing){
		console.log(string, thing, '\n');
	}else{
		console.log(string, '\n');
	}
}
