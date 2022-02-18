const utils = require('../utils/utils.js');
const createConnection = require('./connection.js');

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

class Filter{
	filters = [];

	add(key, value){
		switch(key){
			case 'gametype':
			case 'gamedata':
			case 'gamedataor':{
				if(!Array.isArray(value)) throw new Error(`${key} must be an array`);
				this.filters.push(`\\${key}\\${value.join(',')}`);
				break;
			}
			case 'map':
			case 'gamedir':
			case 'gameaddr':
			case 'name_match':
			case 'version_match':{
				if(typeof value !== 'string') throw new Error(`${key} must be a string`);
				this.filters.push(`\\${key}\\${value}`);
				break;
			}
			case 'napp':
			case 'appid':{
				if(typeof value !== 'number' || isNaN(value) || !Number.isFinite(value)){
					throw new Error(`${key} must be a finite number`);
				}
				this.filters.push(`\\${key}\\${value}`);
				break;
			}
			default:{
				throw new Error(`${key} is not a valid key`);
			}
		}

		return this;
	}
	addFlag(flag){
		if(!(flag in flags)){
			throw new Error(`unknown flag: ${flag}`);
		}

		this.filters.push(flags[flag]);
		return this;
	}
	addFlags(flagsArr){
		for(const flag of flagsArr){
			this.addFlag(flag);
		}
		return this;
	}
	addNOR(filter){
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		this.filters.push(
			`\\nor\\${filter.filters.length}`,
			...filter.filters,
		);
		return this;
	}
	addNAND(filter){
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		this.filters.push(
			`\\nand\\${filter.filters.length}`,
			...filter.filters,
		);

		return this;
	}
}
// # endregion

async function MasterServer(options){
	const connection = await createConnection(options);
	// eslint-disable-next-line prefer-destructuring
	options = connection.options;

	if('filter' in options){
		if(options.filter instanceof Filter){
			options.filter = options.filter.filters.join('');
		}else throw new Error('filter must be an instance of MasterServer.Filter');
	}else options.filter = '';

	const servers = [];

	while(options.quantity > servers.length){
		const last = servers.pop(); // it's returned again in the next payload

		if(last === '0.0.0.0:0') break;

		const command = new utils.BufferWriter()
			.byte(0x31, options.region)
			.string(last || '0.0.0.0:0')
			.string(options.filter)
			.end();

		let buffer;
		try{
			buffer = await connection.query(command, 0x66);
		}catch(e){
			if(servers.length === 0) throw e;
			if(options.enableWarns) console.error(new Error('cannot get full list of servers'));
			break;
		}

		servers.push(...utils.parsers.serverList(buffer));
	}

	connection.destroy();
	return servers;
}

module.exports = MasterServer;
module.exports.Filter = Filter;
module.exports.getIPs = async function getIPs(){
	const [goldSource, source] = await Promise.all([
		'hl1master.steampowered.com',
		'hl2master.steampowered.com',
	].map(utils.resolveHostname));

	return { goldSource, source };
};