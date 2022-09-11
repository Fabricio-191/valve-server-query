import { BufferWriter, BufferReader, type ValueIn, resolveHostname } from '../utils';
import Connection from './connection';

// #region filter
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
} as const;

type Flag = keyof typeof flags;
type FilterKey = 'appid' | 'gameaddr' | 'gamedata' | 'gamedataor' | 'gamedir' | 'gametype' | 'map' | 'name_match' | 'napp' | 'version_match';

class Filter{
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
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
// #endregion

// #region options
const REGIONS = {
	US_EAST: 0,
	US_WEST: 1,
	SOUTH_AMERICA: 2,
	EUROPE: 3,
	ASIA: 4,
	AUSTRALIA: 5,
	MIDDLE_EAST: 6,
	AFRICA: 7,
	OTHER: 0xFF,
} as const;

const DEFAULT_DATA: Required<RawOptions> = {
	ip: 'hl2master.steampowered.com',
	port: 27011,
	timeout: 5000,
	debug: false,
	enableWarns: true,

	quantity: 200,
	region: 'OTHER',
	filter: new Filter(),
} as const;

interface RawOptions {
	ip?: string;
	port?: number;
	timeout?: number;
	debug?: boolean;
	enableWarns?: boolean;

	quantity?: number | 'all';
	region?: keyof typeof REGIONS;
	filter?: Filter;
}

export interface Data {
	address: string;
	ip: string;
	ipFormat: 4 | 6;
	port: number;
	timeout: number;
	debug: boolean;
	enableWarns: boolean;
	quantity: number;
	region: ValueIn<typeof REGIONS>;
	filter: string;
}

type MixedOptions = {
	[key in keyof Data]: key extends keyof RawOptions ?
		Data[key] | Exclude<RawOptions[key], undefined> : Data[key];
};

async function parseData(rawData: RawOptions): Promise<Data> {
	if(typeof rawData !== 'object' || rawData === null){
		throw Error("'options' must be an object");
	}
	const data = Object.assign({}, DEFAULT_DATA, rawData) as MixedOptions;

	if(
		typeof data.port !== 'number' || isNaN(data.port) ||
		data.port < 0 || data.port > 65535
	){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof data.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof data.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(typeof data.timeout !== 'number' || isNaN(data.timeout) || data.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}else if(typeof data.ip !== 'string'){
		throw Error("'ip' should be a string");
	}

	Object.assign(data, await resolveHostname(data.ip));
	data.address = `${data.ip}:${data.port}`;

	if(data.quantity === 'all') data.quantity = Infinity;
	if(data.filter instanceof Filter){
		data.filter = data.filter.filters.join('');
	}
	if(data.region in REGIONS){
		data.region = REGIONS[data.region] as ValueIn<typeof REGIONS>;
	}else{
		throw new Error(`unknown region: ${data.region}`);
	}

	if(typeof data.filter !== 'string'){
		throw Error("'filter' must be an instance of MasterServer.Filter or a string");
	}else if(typeof data.quantity !== 'number' || isNaN(data.quantity) || data.quantity <= 0){
		throw Error("'quantity' must be a number greater than zero");
	}

	return data as Data;
}
// #endregion

export default async function MasterServer(options: RawOptions = {}): Promise<string[]> {
	const data = await parseData(options);
	const connection = new Connection(data);
	const servers: string[] = [];

	while(data.quantity > servers.length){
		const last = servers.pop();

		if(last === '0.0.0.0:0') break;

		const command = new BufferWriter()
			.byte(0x31, data.region)
			.string(last ?? '0.0.0.0:0')
			.string(data.filter)
			.end();

		// eslint-disable-next-line @typescript-eslint/init-declarations
		let buffer: Buffer;
		try{
			buffer = await connection.query(command, 0x66);
		}catch(e){
			if(servers.length === 0) throw e;
			// eslint-disable-next-line no-console
			if(data.enableWarns) console.error(new Error('cannot get full list of servers'));
			break;
		}

		servers.push(...parseServerList(buffer));
	}

	connection.destroy();
	return servers;
}

MasterServer.Filter = Filter;

function parseServerList(buffer: Buffer): string[] {
	const reader = new BufferReader(buffer, 2);
	const servers = [];

	while(reader.hasRemaining){
		servers.push(`${reader.byte()}.${reader.byte()}.${reader.byte()}.${reader.byte()}:${reader.short(true, 'BE')}`);
	}

	return servers;
}
