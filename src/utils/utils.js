const  parsers = require('./parsers.js'), 
	constants = require('./constants.json'),
	decompressBZip = require('./Bzip2.js');

const dns = require('dns'), net = require('net');

class BufferWriter{
	buffer = [];

	string(value){
		return this.byte(
			...Array.from(Buffer.from(value)), 0
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
	parsers,
	constants,
	decompressBZip,
	parseOptions,
	BufferUtils: {
		Parser: parsers.BufferParser,
		Writer: BufferWriter
	}
};

function parseOptions(options){
	if(typeof options !== 'object'){
		throw Error("'options' must be an object");
	}
	options = Object.assign({}, constants.DEFAULT_OPTIONS, options);

	if(!options.ip){
		throw Error('You should put the IP for the server to connect');
	}else if(typeof options.ip !== 'string'){
		throw Error('The ip to connect should be a string');
	}

	if(net.isIP(options.ip) === 0){
		options.ip = resolveHostname(options.ip)
			.catch(() => { 
				throw Error('Introduced ip/hostname is not valid');
			});
	}
	

	options.port = parseInt(options.port);
	if(isNaN(options.port)){
		throw Error('You should put the port for the server to connect');
	}else if(options.port < 0 || options.port > 65535){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof options.timeout !== 'number'){
		throw Error("'timeout' should be a number");
	}else if(typeof options.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}

	return {
		ip: options.ip,
		port: options.port,
		options: {
			timeout: options.timeout,
			maxListeners: options.maxListeners,
			debug: options.debug
		}
	};
}

function resolveHostname(hostname){
	return new Promise((resolve, reject) => {
		dns.resolve(hostname, (err, addresses) => {
			if(err) return reject(err);
	
			resolve(addresses[0]);
		});
	});
}