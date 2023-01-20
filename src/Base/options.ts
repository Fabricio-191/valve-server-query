import { isIPv6 } from 'net';
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
	ip: string;
	port: number;
	timeout: number;
}

export interface MasterServerData extends BaseData {
	quantity: number;
	region: ValueIn<typeof REGIONS>;
	filter: string;
	slow: boolean;
}

export interface RCONData extends BaseData {
	password: string;
}

export type ServerData = BaseData;
// #endregion

// #region raw options
interface BaseRawOptions {
	ip?: string;
	port?: number | string;
	timeout?: number;
}

export type RawRCONOptions = string | (BaseRawOptions & { password: string });
export type RawServerOptions = BaseRawOptions | string;
export type RawMasterServerOptions = string | (BaseRawOptions & {
	quantity?: number | 'all';
	region?: keyof typeof REGIONS;
	filter?: Filter;
	slow?: boolean;
});
// #endregion

// #region default options
const DEFAULT_OPTIONS = {
	ip: '127.0.0.1',
	port: 27015,
	timeout: 5000,
};

const DEFAULT_MASTER_SERVER_OPTIONS = {
	ip: 'hl2master.steampowered.com',
	port: 27011,
	timeout: 5000,

	quantity: 200,
	region: 'ANY' as const,
	filter: new Filter(),
	slow: false,
};

export function setDefaultTimeout(timeout: number): void {
	DEFAULT_OPTIONS.timeout = DEFAULT_MASTER_SERVER_OPTIONS.timeout = timeout;
}
// #endregion

function parseBaseOptions<T>(options: Required<BaseRawOptions> & T): BaseData & T {
	if(typeof options.ip !== 'string'){
		throw Error("'ip' should be a string");
	}else if(options.ip.includes(':') && !isIPv6(options.ip)){
		[options.ip, options.port] = options.ip.split(':') as [string, string];
	}

	if(typeof options.port === 'string'){
		options.port = parseInt(options.port);
	}

	if(!Number.isInteger(options.port) || options.port < 0 || options.port > 65535){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(!Number.isInteger(options.timeout) || options.timeout < 0){
		throw Error("'timeout' should be a integer greater than zero");
	}

	// @ts-expect-error port can't be a string
	return options;
}

export function parseServerOptions(options: RawServerOptions): ServerData {
	if(typeof options === 'string') options = { ip: options };
	if(typeof options !== 'object') throw new TypeError('Options must be an object');

	return parseBaseOptions({
		...DEFAULT_OPTIONS,
		...options,
	});
}

export function parseMasterServerOptions(options: RawMasterServerOptions): MasterServerData {
	if(typeof options === 'string') options = { ip: options };
	if(typeof options !== 'object') throw new TypeError('Options must be an object or a string');

	const parsedOptions = parseBaseOptions({
		...DEFAULT_MASTER_SERVER_OPTIONS,
		...options,
	});

	if(parsedOptions.quantity === 'all'){
		parsedOptions.quantity = Infinity;
	}

	if(!Number.isInteger(options.quantity) || parsedOptions.quantity < 0){
		throw Error("'quantity' should be a number greater than zero");
	}else if(typeof parsedOptions.region !== 'string'){
		throw Error("'region' should be a string");
	}else if(!(parsedOptions.region in REGIONS)){
		throw Error(`'region' should be one of the following: ${Object.keys(REGIONS).join(', ')}`);
	}else if(!(parsedOptions.filter instanceof Filter)){
		throw Error("'filter' should be an instance of Filter");
	}else if(typeof parsedOptions.slow !== 'boolean'){
		throw Error("'slow' should be a boolean");
	}

	// @ts-expect-error quantity is a number
	return {
		...parsedOptions,
		region: REGIONS[parsedOptions.region],
		filter: parsedOptions.filter.toString(),
	};
}

export function parseRCONOptions(options: RawRCONOptions): RCONData {
	if(typeof options === 'string') options = { password: options };
	if(typeof options !== 'object' || options === null) throw new TypeError('Options must be an object');

	const parsedOptions = parseServerOptions(options) as RCONData;

	if(typeof parsedOptions.password !== 'string' || parsedOptions.password === ''){
		throw new Error('RCON password must be a non-empty string');
	}

	return parsedOptions;
}
