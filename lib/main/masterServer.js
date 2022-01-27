const { BufferWriter, parsers, resolveHostname } = require('../utils/utils.js');
const createConnection = require('./connection.js');

async function MasterServer(data){
	const connection = await createConnection(data);

	const { quantity, region, enableWarns } = connection.options;
	const servers = [];

	while(quantity > servers.length){
		const last = servers.pop();

		if(last === '0.0.0.0:0') break;

		const command = new BufferWriter()
			.byte(0x31, region)
			.string(last || '0.0.0.0:0')
			.string('')
			.end();

		let buffer;
		try{
			buffer = await connection.query(command, 0x66);
		}catch(e){
			if(servers.length === 0) throw e;
			if(enableWarns) console.error(new Error('cannot get full list of servers'));
			break;
		}

		servers.push(...parsers.serverList(buffer));
	}

	connection.destroy();
	return servers;
}

module.exports = MasterServer;
module.exports.getIPs = async function getIPs(){
	const [goldSource, source] = await Promise.all([
		resolveHostname('hl1master.steampowered.com'),
		resolveHostname('hl2master.steampowered.com'),
	]);

	return { goldSource, source };
};

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

const MASTER_FILTER = {
	nor: 'object',
	nand: 'object',
	dedicated: 'boolean',
	secure: 'boolean',
	linux: 'boolean',
	password: 'boolean',
	empty: 'boolean',
	full: 'boolean',
	proxy: 'boolean',
	noplayers: 'boolean',
	white: 'boolean',
	collapse_addr_hash: 'boolean',
	gamedir: 'string',
	map: 'string',
	name_match: 'string',
	version_match: 'string',
	gameaddr: 'string',
	appid: 'number',
	napp: 'number',
	gametype: 'array',
	gamedata: 'array',
	gamedataor: 'array',
},
*/
