/* eslint-disable new-cap */
import { debug, resolveHostname } from '../utils';
import Connection, { type Data, PrivateConnection } from './connection';
import * as parsers from './serverParsers';

const FFFFFFFFh = [0xFF, 0xFF, 0xFF, 0xFF] as const;
const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ] as const;
const COMMANDS = {
	INFO_BASE: Buffer.from([
		...FFFFFFFFh, 0x54,
		...Buffer.from('Source Engine Query\0'),
	]),
	INFO(key: Buffer | [] = []){
		return Buffer.from([ ...COMMANDS.INFO_BASE, ...key ]);
	},
	CHALLENGE(code = 0x57, key = FFFFFFFFh){
		return Buffer.from([ ...FFFFFFFFh, code, ...key ]);
	},
	PING: Buffer.from([ ...FFFFFFFFh, 0x69 ]),
};

export default class Server{
	constructor(options: RawOptions, privateConnection = false){
		// @ts-expect-error data is incomplete at this point
		this.data = options;
		if(privateConnection){
			this.connection = new PrivateConnection(this.data);
		}else{
			this.connection = new Connection(this.data);
		}
	}
	private readonly connection: Connection | PrivateConnection;
	public data: Data;
	public isConnected = false;

	public async getInfo(): Promise<FinalServerInfo> {
		if(!this.isConnected){
			throw new Error('Not connected');
		}

		let command = COMMANDS.INFO();
		if(this.data.info.challenge){
			const response = await this.connection.query(command, 0x41);
			const key = response.slice(-4);

			command = COMMANDS.INFO(key);
		}

		const requests = this.data.info.goldSource ? [
			this.connection.query(command, 0x49),
			this.connection.awaitResponse([0x6D]),
		] : [
			this.connection.query(command, 0x49),
		];

		const responses = await Promise.all(requests);

		return Object.assign({}, ...responses.map(parsers.serverInfo)) as FinalServerInfo;
	}

	public async getPlayers(): Promise<parsers.Players> {
		if(!this.isConnected){
			throw new Error('Not connected');
		}

		const key = await this.challenge(0x55);

		if(key[0] === 0x44 && key.length > 5){
			return parsers.players(Buffer.from(key), this.data);
		}

		const command = Buffer.from([
			...FFFFFFFFh, 0x55, ...key.slice(1),
		]);
		const response = await this.connection.query(command, 0x44);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.players(response, this.data);
	}

	public async getRules(): Promise<parsers.Rules>{
		if(!this.isConnected){
			throw new Error('Not connected');
		}

		const key = await this.challenge(0x56);

		if(key[0] === 0x45 && key.length > 5){
			return parsers.rules(Buffer.from(key));
		}

		const command = Buffer.from([
			...FFFFFFFFh, 0x56, ...key.slice(1),
		]);
		const response = await this.connection.query(command, 0x45);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.rules(response);
	}

	public async getPing(): Promise<number> {
		if(!this.isConnected){
			throw new Error('Not connected');
		}

		if(this.data.enableWarns){
			// eslint-disable-next-line no-console
			console.trace('A2A_PING request is a deprecated feature of source servers');
		}

		try{
			const start = Date.now();
			await this.connection.query(COMMANDS.PING, 0x6A);

			return Date.now() - start;
		}catch(e){
			return -1;
		}
	}

	public async challenge(code: number): Promise<Buffer> {
		if(!this.isConnected){
			throw new Error('Not connected');
		}

		const command = COMMANDS.CHALLENGE();
		// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
		if(!CHALLENGE_IDS.includes(this.data.appID)){
			command[4] = code;
		}

		// 0x41 normal challenge response
		// 0x44 truncated rules response
		// 0x45 truncated players response
		const response = await this.connection.query(command, 0x41, code - 0b10001);

		return response;
	}

	public async connect(): Promise<void> {
		if(this.isConnected){
			throw new Error('Server: already connected.');
		}
		this.data = await parseData(this.data);
		await this.connection.connect();

		const info = await _getInfo(this.connection);
		if(this.data.debug) debug('SERVER connected');

		Object.assign(this.data, {
			info: {
				challenge: info.needsChallenge,
				goldSource: info.goldSource,
			},
			appID: info.appID,
			protocol: info.protocol,
		});

		this.isConnected = true;
	}

	public disconnect(): void {
		if(!this.isConnected){
			throw new Error('Not connected');
		}
		this.connection.destroy();
		this.isConnected = false;
	}

	public static async getInfo(options: RawOptions): Promise<FinalServerInfo> {
		const data = await parseData(options);

		const connection = new Connection(data);
		connection.connect();
		const info = await _getInfo(connection);

		connection.destroy();
		return info;
	}
}

type FinalServerInfo = parsers.ServerInfo | parsers.TheShipServerInfo | (parsers.GoldSourceServerInfo & (
	parsers.ServerInfo | parsers.TheShipServerInfo
));

type _ServerInfo = FinalServerInfo & { needsChallenge: boolean };
async function _getInfo(connection: Connection, challenge: Buffer | null = null): Promise<_ServerInfo> {
	if(challenge === null){
		await connection.send(COMMANDS.INFO());
	}else{
		await connection.send(COMMANDS.INFO(challenge));
	}

	const responses = [];

	connection.awaitResponse([0x6d])
		.then(data => responses.push(data))
		.catch(() => { /* do nothing */ });

	const INFO = await connection.awaitResponse([0x49, 0x41]);
	if(INFO[0] === 0x41){
		if(challenge !== null){
			throw new Error('Wrong server response');
		}

		// needs challenge
		return await _getInfo(connection, INFO.slice(1));
	}
	responses.push(INFO);

	return Object.assign({
		address: `${connection.data.ip}:${connection.data.port}`,
		needsChallenge: challenge !== null,
	}, ...responses.map(parsers.serverInfo)) as _ServerInfo;
}

// #region parse data
interface RawOptions {
	ip?: string;
	port?: number;
	timeout?: number;
	debug?: boolean;
	enableWarns?: boolean;
}

const DEFAULT_DATA: Data = {
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

async function parseData(rawData: Partial<Data>): Promise<Data> {
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
	}

	Object.assign(data, await resolveHostname(data.ip));
	data.address = `${data.ip}:${data.port}`;

	return data;
}
// #endregion
