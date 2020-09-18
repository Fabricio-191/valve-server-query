const client = require('dgram').createSocket('udp4');
const { parsers, constants } = require('../utils/utils.js');
const servers = {};

client.on('message', (buffer, rinfo) => {
    let sv = servers[rinfo.address+':'+rinfo.port];
    if(sv) sv(buffer);
});

client.createConnection = async function(options, onMessage, onReady){
    if(options.ip instanceof Promise){
        options.ip = await options.ip;
    }
    let key = options.ip+':'+options.port;

    let timeout = setTimeout(() => {
		throw Error('Can not connect to the server.');
	}, options.timeout)
	
	client.send(Buffer.from(constants.commands.info), options.port, options.ip, err => {
		if(err) throw err;
    })

    servers[key] = buffer => {
        if(buffer.readInt32LE() === -2){
            throw Error('I need to handle this somehow');
        }else{
            let info = parsers.serverInfo(buffer.slice(4));

            onReady(info, options);
        }

        servers[key] = onMessage;
        clearTimeout(timeout);
    }

    return () => {
        delete servers[key];
    };
}

module.exports = client;