const client = require('dgram').createSocket('udp4');
const { constants, parsers, decompressBZip } = require('../utils/utils.js');
const servers = {}, packetsQueues = {};

client.on('message', (buffer, rinfo) => {
	if(buffer.length === 0) return;

    let entry = servers[rinfo.address+':'+rinfo.port];
    if(entry){
        let packet = packetHandler(buffer, entry.server);
        if(!packet) return;

        entry.callback(packet)
	}
});

function packetHandler(buffer, server){ //cambiar
    if(server.options.debug)  console.log('\nRecieved:    ', `<Buffer ${buffer.toString('hex').match(/../g).join(' ')}>`);
    if(buffer.readInt32LE() === -2){
        if(buffer.readInt32LE(9) === -1){
            server._info[1] = true;  //multiPacketResponseIsGoldSource
        }

        const { packetsQueues } = servers[server.ip+':'+server.port];
        let packet = parsers.multiPacketResponse(
            buffer, server
        );

        const queue = packetsQueues[packet.ID]; 

        if(!queue){
            setTimeout(() => {
                delete packetsQueues[packet.ID];
            }, server.options.timeout * 2)

            return packetsQueues[packet.ID] = [packet];
        }else queue.push(packet);

        if(queue.length !== packet.packets.total) return;
        
        if(
            server.multiPacketIsGoldSource && 
            queue.some(p => !p.goldSource)
        ) queue = queue.map(p => parsers.multiPacketResponse(
            p.raw, server
        ))
        
        queue.sort(
            (p1, p2) => p1.packets.current - p2.packets.current
        );
            
        buffer = Buffer.concat(
            queue.map(p => p.payload)
        );

        if(queue[0].bzip) buffer = decompressBZip(finalPayload);
        /*
        I never tried bzip decompression, if you are having trouble with this, contact me on discord
        Fabricio-191#8051, and please send me de ip and port of the server, so i can do tests
        */
    }

    return buffer.slice(4);
}

async function connect(server, callback){
    if(server.ip instanceof Promise){
        server.ip = await server.ip;
    }
    let key = server.ip+':'+server.port;

    if(server.options.debug) console.log('\nSent (initializing):    ', Buffer.from(constants.commands.info));
    client.send(Buffer.from(constants.commands.info), server.port, server.ip, err => {
		if(err) throw err;
    })

    let responses = []
    
    function end(){
        if(responses.length === 0){
			throw Error('Can not connect to the server.');
        }
        
        servers[key].callback = function(buffer){
            server.emit('packet', buffer)
        }

        responses.sort((a, b) => a.goldSource - b.goldSource)
        
        callback(Object.assign({}, ...responses))
        server.emit('ready');
    }

    let timeout = setTimeout(end, server.options.timeout)
    
    servers[key] = { 
        server,
        packetsQueues: {},
        callback: buffer => {
            if(![0x49, 0x6d].includes(buffer[0])) return;
            
            responses.push(
				parsers.serverInfo(buffer)
			);

            clearTimeout(timeout);
			if(responses.length === 2) return end();
                
            timeout = setTimeout(end, server.options.timeout / 3);
        }
    };
}

module.exports = connect;
module.exports.client = client;
module.exports.servers = servers;