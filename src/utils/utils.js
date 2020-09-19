const  parsers = require('./parsers.js'), 
     constants = require('./constants.json'),
decompressBZip = require('./Bzip2.js');

const dns = require('dns'), net = require('net');

module.exports = {
    parsers,
    constants,
    decompressBZip,
    parseOptions
}

function parseOptions(options){
    options = Object.assign(constants.defaultOptions, options)

    if(!options.ip){
        throw Error('You should put the IP for the server to connect')
    }else if(typeof options.ip !== 'string'){
        throw Error('The ip to connect should be a string')
    }

    if(net.isIP(options.ip) === 0){
        options.ip = resolveHostName(options.ip)
        .catch(() => { 
            throw Error('Introduced ip/hostname is not valid')
        })
    }
    
    if(!options.port && options.port !== 0){
        throw Error('You should put the port for the server to connect')
    }else if(
        !Number.isInteger(options.port) || 
        options.port < 0 || options.port > 65535
    ){
        throw Error('The port to connect should be a number between 0 and 65535')
    }
    
    if(typeof options.timeout !== 'number'){
        throw Error('The timeout should be a number');
    }

    return options;
}

function resolveHostname(hostname){
	return new Promise((resolve, reject) => {
		dns.resolve4(hostname, (err, addresses) => {
			if(err) return reject(err);
	
			resolve(addresses[0])
		})
	})
}