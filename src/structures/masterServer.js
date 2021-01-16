const { Connection } = require('./connectionManager.js');
const { constants, parseOptions, BufferWriter, resolveHostname, parsers } = require('../utils/utils.js');

function parseFilter(options = {}) {
	return Object.keys(
		options
	).map(key => {
		const value = options[key],
			type = constants.MASTER_FILTER[key];

		if (
			(type === 'array' && !Array.isArray(value)) ||
			typeof value !== type
		) {
			throw new Error(`filter: value at ${key} must be a ${type}`);
		}

		if (type === 'boolean') {
			return `\\${key}\\${value ? 1 : 0}`;
		} else if (type === 'object') {
			return `\\${key}\\${parseFilter(options[key])}`;
		} else {
			return `\\${key}\\${value}`;
		}
	}).join('\\') || '';
}

function parseQueryOptions(options = {}) {
	let { quantity = Infinity, region = 0xFF, filter } = options;
	if (typeof quantity !== 'number' && quantity <= 0) {
		throw new Error("'quantity' must be a number greater than zero");
	}

	if (typeof region === 'string') {
		region = constants.REGION_CODES[region];
	}

	if (
		!Object.entries(constants.REGION_CODES)
			.some(pair => pair.includes(region))
	) {
		throw new Error('The specified region is not valid');
	}

	return {
		quantity,
		region,
		filter: parseFilter(filter)
	};
}

async function MasterServer(options = {}) {
	if (!options.ip) {
		Object.assign(options, {
			ip: 'hl2master.steampowered.com',
			port: 27011
		});
	}

	let connection = new Connection(
		parseOptions(options)
	);

	if (!connection.ready) await connection._ready();

	let queryOptions = parseQueryOptions(options);
	let servers = [];

	if(queryOptions.region === 'ALL'){
		for(
			let region of Object.values(constants.REGION_CODES)
		){
			while (true) {
				await new Promise(res => setTimeout(res, 20));
				let last = servers[servers.length - 1] || '0.0.0.0:0';
		
				if (servers.length !== 0 && last === '0.0.0.0:0') {
					servers.pop(); break;
				}
		
				const command = new BufferWriter()
					.byte(0x31, region)
					.string(last)
					.string('')
					.end();
		
				connection.send(command);
				let buffer = await connection.awaitPacket(0x66);
				servers.push(...parsers.serverList(buffer));
			}
		}
	}else{
		while (queryOptions.quantity > servers.length) {
			await new Promise(res => setTimeout(res, 20));
			let last = servers[servers.length - 1] || '0.0.0.0:0';
	
			if (servers.length !== 0 && last === '0.0.0.0:0') {
				servers.pop(); break;
			}
	
			const command = new BufferWriter()
				.byte(0x31, queryOptions.region)
				.string(last)
				.string(queryOptions.filter)
				.end();
	
			connection.send(command);
			let buffer = await connection.awaitPacket(0x66);
	
			servers.push(...parsers.serverList(buffer));
		}
	}


	connection.destroy();
	return servers;
}

module.exports = MasterServer;
module.exports.getIPS = () => new Promise((res, rej) => {
	Promise.all([
		resolveHostname('hl1master.steampowered.com'),
		resolveHostname('hl2master.steampowered.com')
	]).then(
		([goldSource, source]) => res({ goldSource, source })
	).catch(rej);
});