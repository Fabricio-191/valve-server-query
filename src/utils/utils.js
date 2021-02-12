const parsers = require('./parsers.js'),
	constants = require('./constants.json'),
	decompressBZip = require('./Bzip2.js');

const dns = require('dns'), net = require('net');

class BufferWriter{
	buffer = [];

	string(value){
		return this.byte(
			...Buffer.from(value), 0
		);
	}

	byte(...values){
		this.buffer.push(...values);

		return this;
	}

	end(){
		return Buffer.from(this.buffer);
	}
}

module.exports = {
	BufferWriter,

	parsers,
	constants,

	decompressBZip,
	debug,

	parseOptions,
	resolveHostname,
};

async function parseOptions(options){
	if(typeof options !== 'object'){
		throw Error("'options' must be an object");
	}
	options = Object.assign({}, constants.DEFAULT_OPTIONS, options);

	if(!options.ip){
		throw Error('You should put the IP for the server to connect');
	}else if(typeof options.ip !== 'string'){
		throw Error('The ip to connect should be a string');
	}else if(net.isIP(options.ip) === 0){
		[options.ip] = await resolveHostname(options.ip);

		if(!options.ip) throw new Error('Invalid ip/hostname');
	}

	options.port = parseInt(options.port, 10);
	if(isNaN(options.port) || options.port < 0 || options.port > 65535){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof options.timeout !== 'number'){
		throw Error("'timeout' should be a number");
	}else if(typeof options.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof options.disableWarns !== 'boolean'){
		throw Error("'disableWarns' should be a boolean");
	}

	return options;
}

function debug(string, buffer){
	string = `\x1B[33m${string}\x1B[0m`;
	if(buffer){
		console.log(string, `<Buffer ${
			Buffer.from(buffer)
				.toString('hex')
				.match(/../g)
				.join(' ')
		}>`);
	}else{
		console.log(string);
	}
	console.log();
}

function resolveHostname(hostname){
	return new Promise((res, rej) => {
		dns.resolve(hostname, (err, addresses) => {
			if(err) return rej(err);

			res(addresses);
		});
	});
}