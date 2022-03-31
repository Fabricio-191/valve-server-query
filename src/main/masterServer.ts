import { BufferWriter, BufferReader } from '../utils/utils';
import createConnection from './connection';

const MASTER_SERVER = {
	REGIONS: {
		US_EAST: 0,
		US_WEST: 1,
		SOUTH_AMERICA: 2,
		EUROPE: 3,
		ASIA: 4,
		AUSTRALIA: 5,
		MIDDLE_EAST: 6,
		AFRICA: 7,
		OTHER: 255,
	},
	DEFAULT_OPTIONS: {
		ip: 'hl2master.steampowered.com',
		port: 27011,
		timeout: 5000,
		debug: false,
		enableWarns: true,
		quantity: 200,
		region: 'OTHER',
	},
};

async function parseOptions(options = {}, isMasterServer = false){
	if(typeof options !== 'object'){
		throw Error("'options' must be an object");
	}

	if(isMasterServer){
		options = Object.assign({}, MASTER_SERVER.DEFAULT_OPTIONS, options);

		if(options.quantity === 'all') options.quantity = Infinity;

		if(typeof options.quantity !== 'number' || isNaN(options.quantity) || options.quantity <= 0){
			throw Error("'quantity' must be a number greater than zero");
		}else if(options.region in MASTER_SERVER.REGIONS){
			options.region = MASTER_SERVER.REGIONS[options.region];
		}else{
			throw Error('The specified region is not valid');
		}
	}else{
		options = Object.assign({}, DEFAULT_OPTIONS, options);
	}

	if(
		typeof options.port !== 'number' || isNaN(options.port) ||
		options.port < 0 || options.port > 65535
	){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof options.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof options.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(isNaN(options.timeout) || options.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}

	options.ip = await resolveIP(options.ip);

	return options;
}

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
type Flag = keyof typeof flags;
type FilterKey = 'appid' | 'gameaddr' | 'gamedata' | 'gamedataor' | 'gamedir' | 'gametype' | 'map' | 'name_match' | 'napp' | 'version_match';

export class Filter{
	public readonly filters: string[] = [];

	public add(key: FilterKey, value: string[] | number | string): this {
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
	public addFlag(flag: Flag): this {
		if(!(flag in flags)){
			throw new Error(`unknown flag: ${flag}`);
		}

		this.filters.push(flags[flag]);
		return this;
	}
	public addFlags(flagsArr: Flag[]): this {
		for(const flag of flagsArr){
			this.addFlag(flag);
		}
		return this;
	}
	public addNOR(filter: Filter): this {
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		this.filters.push(
			`\\nor\\${filter.filters.length}`,
			...filter.filters
		);
		return this;
	}
	public addNAND(filter: Filter): this {
		if(!(filter instanceof Filter)){
			throw new Error('filter must be an instance of MasterServer.Filter');
		}

		this.filters.push(
			`\\nand\\${filter.filters.length}`,
			...filter.filters
		);

		return this;
	}
}
// # endregion

export default async function MasterServer(options): Promise<string[]> {
	const connection = await createConnection(options);
	options = connection.options;

	if('filter' in options){
		if(options.filter instanceof Filter){
			options.filter = options.filter.filters.join('');
		}else throw new Error('filter must be an instance of MasterServer.Filter');
	}else options.filter = '';

	const servers: string[] = [];

	while(options.quantity > servers.length){
		const last = servers.pop(); // it's returned again in the next payload

		if(last === '0.0.0.0:0') break;

		const command = new BufferWriter()
			.byte(0x31, options.region)
			.string(last ?? '0.0.0.0:0')
			.string(options.filter)
			.end();

		let buffer: Buffer;
		try{
			buffer = await connection.query(command, 0x66);
		}catch(e){
			if(servers.length === 0) throw e;
			if(options.enableWarns) console.error(new Error('cannot get full list of servers'));
			break;
		}

		servers.push(...serverList(buffer));
	}

	connection.destroy();
	return servers;
}

export function serverList(buffer: Buffer): string[] {
	const reader = new BufferReader(buffer, 2);
	const servers = [];

	while(reader.remaining().length){
		const ip = [
			reader.byte(),
			reader.byte(),
			reader.byte(),
			reader.byte(),
		].join('.');

		servers.push(ip + ':' + reader.short(true, 'BE'));
	}

	return servers;
}
