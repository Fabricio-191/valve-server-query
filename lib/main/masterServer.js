const utils = require('../utils/utils.js');
const createConnection = require('./connection.js');

async function MasterServer(data){
	const connection = await createConnection(data);

	const { quantity, region, enableWarns } = connection.options;
	const filter = 'filter' in data ?
		parseFilters(data.filter) : '';
	const servers = [];

	while(quantity > servers.length){
		const last = servers.pop(); // it's returned again in the next payload

		if(last === '0.0.0.0:0') break;

		const command = new utils.BufferWriter()
			.byte(0x31, region)
			.string(last || '0.0.0.0:0')
			.string(filter)
			.end();

		let buffer;
		try{
			buffer = await connection.query(command, 0x66);
		}catch(e){
			if(servers.length === 0) throw e;
			if(enableWarns) console.error(new Error('cannot get full list of servers'));
			break;
		}

		servers.push(...utils.parsers.serverList(buffer));
	}

	connection.destroy();
	return servers;
}

module.exports = MasterServer;
module.exports.getIPs = async function getIPs(){
	const [goldSource, source] = await Promise.all([
		'hl1master.steampowered.com',
		'hl2master.steampowered.com',
	].map(utils.resolveHostname));

	return { goldSource, source };
};

// # region filter
const flags = {
	dedicated: '\\dedicated\\1',
	secure: '\\secure\\1',
	linux: '\\linux\\1',
	empty: '\\empty\\1',
	full: '\\full\\1',
	proxy: '\\proxy\\1',
	noplayers: '\\noplayers\\1',
	white: '\\white\\1',
	collapse_addr_hash: '\\collapse_addr_hash\\1',
	password: '\\password\\0',
};

const keys = [
	'map',
	'gamedir',
	'gameaddr',
	'name_match',
	'version_match',

	'napp',
	'appid',

	'gametype',
	'gamedata',
	'gamedataor',

	'nor',
	'nand',
];

function parseFilters(filters){
	if(!Array.isArray(filters)) throw new Error('filters must be an array');
	return filters.map(parseFilter).join('');
}

// eslint-disable-next-line complexity
function parseFilter(filter){
	if(typeof filter !== 'object' || Array.isArray(filter) || filter === null){
		throw new Error('filter must be an object');
	}

	const filters = [];

	if('flags' in filter){
		if(!Array.isArray(filter.flags)){
			throw new Error('filter.flags must be an array');
		}

		for(const flag of filter.flags){
			if(!(flag in flags)){
				throw new Error(`unknown flag: ${flag}`);
			}

			filters.push(flags[flag]);
		}
	}

	for(const k of keys){
		if(!(k in filter)) continue;
		const value = filter[k];

		switch(k){
			case 'nor':
			case 'nand':{
				const subfilters = parseFilter(value);
				filters.push(
					`\\${k}\\${subfilters.length}`,
					...subfilters,
				);
				break;
			}
			case 'gametype':
			case 'gamedata':
			case 'gamedataor':{
				if(!Array.isArray(value)) throw new Error(`filter.${k} must be an array`);
				filters.push(`\\${k}\\${value.join(',')}`);
				break;
			}
			case 'map':
			case 'gamedir':
			case 'gameaddr':
			case 'name_match':
			case 'version_match':{
				if(typeof value !== 'string') throw new Error(`filter.${k} must be a string`);
				filters.push(`\\${k}\\${value}`);
				break;
			}
			case 'napp':
			case 'appid':{
				if(typeof value !== 'number' || isNaN(value) || !Number.isFinite(value)){
					throw new Error(`filter.${k} must be a finite number`);
				}
				filters.push(`\\${k}\\${value}`);
				break;
			}
			default:{
				throw new Error(`${k} is not a valid key`);
			}
		}
	}

	return filters;
}

// # endregion filter