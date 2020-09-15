const  parsers = require('./parsers.js'), 
     constants = require('./constants.json'),
decompressBZip = require('./Bzip2.js');

module.exports = {
    parsers,
    constants,
    decompressBZip,
    resolveHostname,
    parseOptions
}

function parseOptions(options){
    options = Object.assign(constants.defaultOptions, {
        ip: options.ip || options.address,
        port: Number(options.port) || 27015,
        timeout: options.timeout,
        debug: options.debug
    })

    if(!options.ip){
        throw Error('You should put the IP for the server to connect')
    }else if(typeof options.ip !== 'string'){
        throw Error('The ip to connect should be a string')
    }

    if(options.ip.split('.').length !== 4){
        options.ip = resolveHostName(options.ip)
            .catch(err => {
                throw Error('Introduced ip/hostname is not valid')
            })
    }
    
    if(!options.port && options.port !== 0){
        throw Error('You should put the port for the server to connect')
    }else if(
        typeof options.port !== 'number' || 
        options.port > 65535 || options.port < 0
    ){
        throw Error('The port to connect should be a number between 0 and 65535')
    }
    
    if(options.timeout && typeof options.timeout !== 'number'){
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