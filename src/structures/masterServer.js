const { Connection } = require('./connectionManager.js');
const { constants, parseOptions, BufferUtils } = require('../utils/utils.js');
const parsers = require('../utils/parsers.js');

async function MasterServer(options = {}){
	if(!options.ip){
		Object.assign(options, {
			ip: 'hl2master.steampowered.com',
			port: 27011
		});
	}
	Object.assign(this, parseOptions(options));
	this.connection = new Connection(this);

	if(!this.connection.ready) await this.connection._ready();

	options = parseQueryOptions(options);
	let servers = [];

	while(options.quantity > servers.length){
		let last = servers[servers.length -1] || '0.0.0.0:0';

		if(servers.length !== 0 && last === '0.0.0.0:0'){
			servers.pop(); break;
		}	

		const command = new BufferUtils.Writer()
			.byte(0x31, constants.REGION_CODES[options.region])
			.string(last)
			.string(parseFilter(options.filter))
			.end();
			
		this.connection.send(command);
		let buffer = await this.connection.awaitPacket(0x66);
				
		servers.push(...parsers.serverList(buffer));
	}

	this.connection.destroy();
	return servers;
}

function parseFilter(options = {}){
	let str = [];

	if(options.nor){
		str.push(`\\nor\\[${
			parseFilter(options.nor)
		}]`);
	}
	if(options.nand){
		str.push(`\\nand\\[${
			parseFilter(options.nand)
		}]`);
	}

	Object.keys(
		constants.MASTER_FILTER
	).map(key => {
		const value = options[key], type = constants.MASTER_FILTER[key];

		if(value == undefined) return;
		switch(type){
			case 'boolean':{
				if(![0, 1, true, false].includes(value)){
					throw new Error(`filter: value at ${key} must be a ${type}`);
				}

				return str.push(`\\${key}\\${ value ? 1 : 0 }`);
			}
			case 'string':{
				if(typeof value !== 'string'){
					throw new Error(`filter: value at ${key} must be a ${type}`);
				}

				return str.push(`\\${key}\\${value}`);
			}
			case 'number':{
				if(typeof value !== 'number'){
					throw new Error(`filter: value at ${key} must be a ${type}`);
				}

				return str.push(`\\${key}\\${value}`);
			}
			case 'array':{
				if(!Array.isArray(value)){
					throw new Error(`filter: value at ${key} must be a ${type}`);
				}

				return str.push(`\\${key}\\${value.join(',')}`);
			}
			default:{
				throw new Error('Unknown error');
			}
		}
	});

	return str.join('\\') || '';
}

function parseQueryOptions(options = {}){
	let { quantity = Infinity, region = 0xFF, filter } = options;
	if(typeof quantity !== 'number' && quantity <= 0){
		throw new Error("'quantity' must be a number that cannot be zero or lower");
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