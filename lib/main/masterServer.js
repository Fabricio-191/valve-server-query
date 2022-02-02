const utils = require('../utils/utils.js');
const createConnection = require('./connection.js');

async function MasterServer(data){
	const connection = await createConnection(data);

	const { quantity, region, enableWarns } = connection.options;
	const filter = 'filter' in data ?
		parseFilter(data.filter).join('') : '';
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

const FILTERS = {
	map: 'string',
	gamedir: 'string',
	gameaddr: 'string',
	name_match: 'string',
	version_match: 'string',

	napp: 'number',
	appid: 'number',

	gametype: 'array',
	gamedata: 'array',
	gamedataor: 'array',

	nor: 'filter',
	nand: 'filter',
};

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

// eslint-disable-next-line complexity
function parseFilter(filter, key){
	if(
		typeof filter !== 'object' ||
		Array.isArray(filter) ||
		filter === null
	){
		throw new Error(`filter${key ? '.' + key : ''} must be an object`);
	}

	const filters = [];

	if('flags' in filter){
		if(!Array.isArray(filter.flags)){
			throw new Error('filter.flags must be an array');
		}

		for(const flag of filter.flags){
			if(!(flag in flags)){
				throw new Error(`filter.flags contains an unknown flag: ${flag}`);
			}

			filters.push(flags[flag]);
		}
	}

	// eslint-disable-next-line guard-for-in
	for(const k in FILTERS){
		if(k === 'flags' || !(k in filter)) continue;
		const value = filter[k];

		switch(FILTERS[k]){
			case 'array':{
				if(!Array.isArray(value)) throw new Error(`filter.${k} must be an array`);
				filters.push(`\\${k}\\${value.join(',')}`);
				break;
			}
			case 'boolean':{
				if(typeof value !== 'boolean') throw new Error(`filter.${k} must be a boolean`);
				filters.push(`\\${k}\\${value ? '1' : '0'}`);
				break;
			}
			case 'filter':{
				const subfilters = parseFilter(value, k);
				filters.push(
					`\\${k}\\${subfilters.length}`,
					...subfilters,
				);
				break;
			}
			case 'string':{
				if(typeof value !== 'string') throw new Error(`filter.${k} must be a string`);
				filters.push(`\\${k}\\${value}`);
				break;
			}
			case 'number':{
				if(typeof value !== 'number' || isNaN(value)) throw new Error(`filter.${k} must be a number`);
				filters.push(`\\${k}\\${value}`);
				break;
			}
			default:{
				throw new Error(`filter.${k} is not a valid filter`);
			}
		}
	}

	return filters;
}