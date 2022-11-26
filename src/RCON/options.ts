import { resolveHostname } from '../utils';

export interface Data {
	address: string;
	ip: string;
	ipFormat: 4 | 6;
	port: number;
	timeout: number;
	debug: boolean;
	enableWarns: boolean;
	password: string;
}

export interface RawOptions extends Partial<Data> {
	password: string;
}

const DEFAULT_DATA: Omit<Data, 'password'> = {
	address: '127.0.0.1:27015',
	ip: '127.0.0.1',
	ipFormat: 4,
	port: 27015,
	timeout: 5000,
	debug: false,
	enableWarns: true,
} as const;

export async function parseData(rawData: RawOptions): Promise<Data> {
	if(typeof rawData !== 'object' || rawData === null){
		throw Error("'options' must be an object");
	}
	const data = Object.assign({}, DEFAULT_DATA, rawData);

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
	}else if(typeof data.password !== 'string'){
		throw new Error('RCON password must be a string');
	}

	Object.assign(data, await resolveHostname(data.ip));
	data.address = `${data.ip}:${data.port}`;

	return data;
}
