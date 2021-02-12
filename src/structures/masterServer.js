const { Connection } = require('./connection.js');
const { constants, BufferWriter, parsers, resolveHostname } = require('../utils/utils.js');

/*
function parseFilter(filter = {}){
	if(typeof filter !== 'object'){
		throw new Error('filter must be an object');
	}

	return Object.keys(
		filter
	).map(key => {
		const value = filter[key],
			type = constants.MASTER_FILTER[key];

		if(
			type === 'array' && !Array.isArray(value) ||
			typeof value !== type
		){
			throw new Error(`filter: value at ${key} must be a ${type}`);
		}

		if(type === 'boolean'){
			return `\\${key}\\${value ? 1 : 0}`;
		}else if(type === 'object'){
			return `\\${key}\\${parseFilter(filter[key])}`;
		}
		return `\\${key}\\${value}`;
	}).join('\\') || '';
}
*/

function parseQueryOptions(options = {}){
	let { quantity = 200, region = 0xFF, filter } = options;
	if(filter) throw new Error('filter is not supported');

	if(quantity === 'all'){
		quantity = Infinity;
	}

	if(typeof quantity !== 'number' && quantity <= 0){
		throw new Error("'quantity' must be a number greater than zero");
	}

	if(typeof region === 'string'){
		region = constants.REGION_CODES[region];
	}

	if(
		!Object.entries(constants.REGION_CODES)
			.some(pair => pair.includes(region))
	) throw new Error('The specified region is not valid');


	return {
		quantity,
		region,
	};
}

async function MasterServer(options = {}){
	if(!options.ip) Object.assign(options, {
		ip: 'hl2master.steampowered.com',
		port: 27011,
	});

	const connection = await Connection.init(options);

	const queryOptions = parseQueryOptions(options);
	const servers = [];

	while(queryOptions.quantity > servers.length){
		const last = servers.pop();

		if(last === '0.0.0.0:0') break;

		const command = (new BufferWriter)
			.byte(0x31, queryOptions.region)
			.string(last || '0.0.0.0:0')
			.string('')
			.end();

		connection.send(command);

		let buffer;
		try{
			buffer = await connection.awaitPacket(0x66);
		}catch(e){
			if(servers.length === 0) throw e;
			if(!this.connection.disableWarns){
				console.trace('cannot get full list of servers');
			}
			break;
		}

		servers.push(...parsers.serverList(buffer));
	}

	connection.destroy();
	return servers;
}

module.exports = MasterServer;
module.exports.getIPS = async function getIPS(){
	const [goldSource, source] = await Promise.all([
		resolveHostname('hl1master.steampowered.com'),
		resolveHostname('hl2master.steampowered.com')
	]);

	return { goldSource, source };
};