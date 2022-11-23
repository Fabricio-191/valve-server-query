import { resolveHostname } from '../utils';

export interface RawOptions {
	ip?: string;
	port?: number;
	timeout?: number;
	debug?: boolean;
	enableWarns?: boolean;
}

export interface ServerData {
	address: string;

	ip: string;
	ipFormat: 4 | 6;
	port: number;
	timeout: number;
	debug: boolean;
	enableWarns: boolean;

	appID: number;
	multiPacketGoldSource: boolean;
	protocol: number;
	info: {
		challenge: boolean;
		goldSource: boolean;
	};
}

const DEFAULT_DATA: ServerData = {
	address: '127.0.0.1:27015',
	ip: '127.0.0.1',
	ipFormat: 4,

	port: 27015,
	timeout: 5000,
	debug: false,
	enableWarns: true,

	appID: -1,
	multiPacketGoldSource: false,
	protocol: -1,
	info: {
		challenge: false,
		goldSource: false,
	},
} as const;

export async function checkOptions(data: Partial<ServerData>): Promise<void> {
	if(typeof data !== 'object' || data === null){
		throw Error("'options' must be an object");
	}

	for(const key in DEFAULT_DATA){
		if(!(key in data)){
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			data[key] = DEFAULT_DATA[key];
		}
	}

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
}
