import { BufferWriter, BufferReader, type ValueIn, resolveHostname } from '../utils';
import Connection from '../connection';
import Filter from './filter';

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

// #region options
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

export interface MasterServerData {
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
	[key in keyof MasterServerData]: key extends keyof RawOptions ?
		Exclude<RawOptions[key], undefined> | MasterServerData[key] : MasterServerData[key];
};

async function parseData(rawData: RawOptions): Promise<MasterServerData> {
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

	return data as MasterServerData;
}
// #endregion

export default async function MasterServer(options: RawOptions = {}): Promise<string[]> {
	const data = await parseData(options);
	const connection = new Connection(data);
	connection.connect();
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
