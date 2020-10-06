const { Connection } = require('./connectionManager.js');
const { constants, parseOptions, BufferUtils, resolveHostname } = require('../utils/utils.js');
const parsers = require('../utils/parsers.js');

async function MasterServer(options = {}){
	if(!options.ip){
		Object.assign(options, {
			ip: 'hl2master.steampowered.com',
			port: 27011
		});
	}

	let connection = new Connection(
		parseOptions(options)
	);

	if(!connection.ready) await connection._ready();

	let queryOptions = parseQueryOptions(options);
	let servers = [];

	while(queryOptions.quantity > servers.length){
		let last = servers[servers.length -1] || '0.0.0.0:0';

		if(servers.length !== 0 && last === '0.0.0.0:0'){
			servers.pop(); break;
		}	

		const command = new BufferUtils.Writer()
			.byte(0x31, constants.REGION_CODES[queryOptions.region])
			.string(last)
			.string(queryOptions.filter)
			.end();
			
		connection.send(command);
		let buffer = await connection.awaitPacket(0x66);
				
		servers.push(...parsers.serverList(buffer));
	}

	connection.destroy();
	return servers;
}

function parseFilter(options = {}){
	return Object.keys(
		constants.MASTER_FILTER
	).map(key => {
		const value = options[key], type = constants.MASTER_FILTER[key];

		if(value == undefined) return;
		switch(type){
			case 'boolean':{
				if(![0, 1, true, false].includes(value)){
					throw new Error(`filter: value at ${key} must be a ${type}`);
				}

				return `${key}\\${ value ? 1 : 0 }`;
			}
			case 'array':
			case 'number':
			case 'string':{
				if(typeof value !== type){
					throw new Error(`filter: value at ${key} must be a ${type}`);
				}

				return `\\${key}\\${value}`;
			}
			case '*': {
				return `\\${key}\\${parseFilter(options[key])}`;
			}
			default:{
				throw new Error('Unknown error');
			}
		}
	}).filter(k => k).join('\\') || '';
}

function parseQueryOptions(options = {}){
	let { quantity = Infinity, region = 0xFF, filter } = options;
	if(typeof quantity !== 'number' && quantity <= 0){
		throw new Error("'quantity' must be a number greater than zero");
	}
	
	if(typeof region === 'string'){
		region = constants.REGION_CODES[region];
	}
	
	if(!region || !Object.values(constants.REGION_CODES).includes(region)){
		throw new Error('The specified region is not valid');
	}

	return {
		quantity, region,
		filter: parseFilter(filter)
	};
}

module.exports = MasterServer;
module.exports.getIPS = function(){
	return new Promise((res, rej) => {
		Promise.all([
			resolveHostname('hl1master.steampowered.com'),
			resolveHostname('hl2master.steampowered.com')
		]).then(([goldSource, source]) => {
			res({goldSource, source});
		}).catch(rej);
	});
};