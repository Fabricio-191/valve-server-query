import { isIPv6 } from 'net';
import { lookup } from 'dns/promises';
import { type ValueIn } from './utils';
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
	ANY: 0xFF,
} as const;

// #region data types
export interface BaseData {
	address: string;

	ip: string;
	port: number;
	timeout: number;
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
}
// #endregion

// #region raw options
interface BaseRawOptions {
	ip?: string;
	port?: number | string;
	timeout?: number;
	enableWarns?: boolean;
}

export type RawRCONOptions = string | (BaseRawOptions & { password: string });
export type RawServerOptions = BaseRawOptions | string;
export type RawMasterServerOptions = string | (BaseRawOptions & {
	quantity?: number | 'all';
	region?: keyof typeof REGIONS;
	filter?: Filter;
});
// #endregion

// #region default options
const DEFAULT_OPTIONS = {
	ip: '127.0.0.1',
	port: 27015,
	timeout: 5000,
	enableWarns: true,
} as const;

const DEFAULT_SERVER_OPTIONS = {
	...DEFAULT_OPTIONS,
	appID: -1,
	multiPacketGoldSource: false,
	protocol: -1,
} as const;

const DEFAULT_MASTER_SERVER_OPTIONS = {
	ip: 'hl2master.steampowered.com',
	port: 27011,
	timeout: 5000,
	enableWarns: true,

	quantity: 200,
	region: 'ANY',
	filter: new Filter(),
} as const;

export function setDefaultOptions(options: BaseRawOptions): void {
	Object.assign(DEFAULT_OPTIONS, options);
}
// #endregion

async function resolveHostname(options: Required<BaseRawOptions>): Promise<void> {
	if(options.ip.includes(':') && !isIPv6(options.ip)){
		[options.ip, options.port] = options.ip.split(':') as [string, string];
	}

	try{
		const r = await lookup(options.ip, { verbatim: false });
		if(r.family !== 4 && r.family !== 6){
			// eslint-disable-next-line @typescript-eslint/no-throw-literal
			throw '';
		}
	}catch(e){
		throw Error("'ip' is not a valid IP address or hostname");
	}
}

async function parseBaseOptions<T>(options: Required<BaseRawOptions> & T): Promise<BaseData & T> {
	if(!Number.isInteger(options.port) || options.port < 0 || options.port > 65535){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof options.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(typeof options.timeout !== 'number' || isNaN(options.timeout) || options.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}else if(typeof options.ip !== 'string'){
		throw Error("'ip' should be a string");
	}

	await resolveHostname(options);

	if(typeof options.port === 'string'){
		options.port = parseInt(options.port);
	}

	// @ts-expect-error port can't be a string
	return {
		...options,
		address: `${options.ip}:${options.port}`,
	};
}

export async function parseServerOptions(options: RawServerOptions): Promise<ServerData> {
	if(typeof options === 'string') options = { ip: options };
	if(typeof options !== 'object' || options === null) throw new TypeError('Options must be an object');

	return await parseBaseOptions({
		...DEFAULT_SERVER_OPTIONS,
		...options,
	});
}

export async function parseMasterServerOptions(options: RawMasterServerOptions): Promise<MasterServerData> {
	if(typeof options !== 'object' || options === null) throw new TypeError('Options must be an object');
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

export async function parseRCONOptions(options: RawRCONOptions | null = null): Promise<RCONData> {
	if(typeof options !== 'object' || options === null) throw new TypeError('Options must be an object');
	if(typeof options === 'string') options = { password: options };

	const parsedOptions = await parseBaseOptions({
		...DEFAULT_OPTIONS,
		...options,
	});

	if(typeof parsedOptions.password !== 'string' || parsedOptions.password === ''){
		throw new Error('RCON password must be a non-empty string');
	}

	return parsedOptions;
}
