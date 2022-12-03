import { type ValueIn, resolveHostname } from './utils';
import Filter from '../MasterServer/filter';

export const REGIONS = {
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

// #region data types
export interface BaseData {
	address: string;

	ip: string;
	ipFormat: 4 | 6;
	port: number;
	timeout: number;
	debug: boolean;
	enableWarns: boolean;
}

export interface MasterServerData extends BaseData {
	quantity: number;
	region: ValueIn<typeof REGIONS>;
	filter: string;
}

export interface RCONData extends BaseData {
	password: string;
}

export interface ServerData extends BaseData {
	appID: number;
	multiPacketGoldSource: boolean;
	protocol: number;
	info: {
		challenge: boolean;
		goldSource: boolean;
	};
}
// #endregion

// #region raw options
interface BaseRawOptions {
	ip?: string;
	port?: number | string;
	timeout?: number;
	debug?: boolean;
	enableWarns?: boolean;
}

export type RawRCONOptions = BaseRawOptions & { password: string };
export type RawServerOptions = BaseRawOptions | string;
export type RawMasterServerOptions = string | BaseRawOptions & {
	quantity?: number | 'all';
	region?: keyof typeof REGIONS;
	filter?: Filter;
};
// #endregion

// #region options
const DEFAULT_OPTIONS = {
	ip: '127.0.0.1',
	port: 27015,
	timeout: 5000,
	debug: false,
	enableWarns: true,
} as const;

const DEFAULT_SERVER_OPTIONS = {
	...DEFAULT_OPTIONS,
	appID: -1,
	multiPacketGoldSource: false,
	protocol: -1,
	info: {
		challenge: false,
		goldSource: false,
	},
} as const;

const DEFAULT_MASTER_SERVER_OPTIONS = {
	ip: 'hl2master.steampowered.com',
	port: 27011,
	timeout: 5000,
	debug: false,
	enableWarns: true,

	quantity: 200,
	region: 'OTHER',
	filter: new Filter(),
} as const;
// #endregion

async function parseBaseOptions<T>(options: Required<BaseRawOptions> & T): Promise<BaseData & T> {
	if(options.ip.includes(':')){
		[options.ip, options.port] = options.ip.split(':') as [string, string];
	}
	if(typeof options.port === 'string'){
		options.port = parseInt(options.port);
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
	}else if(typeof options.timeout !== 'number' || isNaN(options.timeout) || options.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}else if(typeof options.ip !== 'string'){
		throw Error("'ip' should be a string");
	}

	const { ip, ipFormat } = await resolveHostname(options.ip);

	// @ts-expect-error port can't be a string
	return {
		...options,
		ip,
		ipFormat,
		address: `${ip}:${options.port}`,
	};
}

export function parseServerOptions(options: RawServerOptions): Promise<ServerData> {
	if(typeof options === 'string') options = { ip: options };

	return parseBaseOptions({
		...DEFAULT_SERVER_OPTIONS,
		...options,
	}) as Promise<ServerData>;
}

export async function parseMasterServerOptions(options: RawMasterServerOptions): Promise<MasterServerData> {
	if(typeof options === 'string') options = { ip: options };

	const parsedOptions = await parseBaseOptions({
		...DEFAULT_MASTER_SERVER_OPTIONS,
		...options,
	});

	if(parsedOptions.quantity === 'all'){
		parsedOptions.quantity = Infinity;
	}

	if(typeof parsedOptions.quantity !== 'number' || isNaN(parsedOptions.quantity) || parsedOptions.quantity < 0){
		throw Error("'quantity' should be a number greater than zero");
	}else if(typeof parsedOptions.region !== 'string'){
		throw Error("'region' should be a string");
	}else if(!(parsedOptions.region in REGIONS)){
		throw Error(`'region' should be one of the following: ${Object.keys(REGIONS).join(', ')}`);
	}else if(!(parsedOptions.filter instanceof Filter)){
		throw Error("'filter' should be an instance of Filter");
	}

	return {
		...parsedOptions,
		quantity: parsedOptions.quantity,
		region: REGIONS[parsedOptions.region],
		filter: parsedOptions.filter.toString(),
	};
}

export async function parseRCONOptions(options: RawRCONOptions): Promise<RCONData> {
	const parsedOptions = await parseBaseOptions({
		...DEFAULT_OPTIONS,
		...options,
	});

	if(typeof parsedOptions.password !== 'string'){
		throw Error("'password' should be a string");
	}

	return {
		...parsedOptions,
		password: options.password,
	};
}