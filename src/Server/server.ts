/* eslint-disable new-cap */
import { debug } from '../utils';
import Connection, { type Options } from './connection';
import * as parsers from './serverParsers';

// #region Options
const DEFAULT_OPTIONS: Options = {
	ip: 'localhost',
	port: 27015,
	timeout: 5000,
	debug: false,
	enableWarns: true,
} as const;

async function parseOptions(options: Partial<Options>): Promise<Options> {
	if(typeof options !== 'object'){
		throw Error("'options' must be an object");
	}

	const opts = Object.assign({}, DEFAULT_OPTIONS, options);

	if(
		typeof opts.port !== 'number' ||
		isNaN(opts.port) ||
		opts.port < 0 ||
		opts.port > 65535
	){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof opts.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof opts.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(isNaN(opts.timeout) || opts.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}

	// const { ip, format } = await resolveIP(options.ip);

	return opts;
}
// #endregion

const BIG_F = [0xFF, 0xFF, 0xFF, 0xFF] as const;
const INFO_S = [
	...BIG_F, 0x54,
	...Buffer.from('Source Engine Query\0'),
] as const;

const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ] as readonly number[];
const COMMANDS = {
	INFO(key: Buffer | number[] = BIG_F){
		return Buffer.from([ ...INFO_S, ...key ]);
	},
	CHALLENGE(code = 0x57, key = BIG_F){
		return Buffer.from([ ...BIG_F, code, ...key ]);
	},
	PING: Buffer.from([ ...BIG_F, 0x69 ]),
};

class Server{
	constructor(connection: Connection){
		this.connection = connection;
	}
	private readonly connection: Connection;

	public async getInfo(): Promise<parsers.FServerInfo> {
		let command = COMMANDS.INFO();
		if(this.connection.meta.info.challenge){
			const response = await this.connection.query(command, 0x41);
			const key = response.slice(-4);

			command = COMMANDS.INFO(key);
		}

		const requests = [
			this.connection.query(command, 0x49),
		];

		if(this.connection.meta.info.goldSource) requests.push(
			this.connection.awaitResponse([0x6D])
		);

		const responses = await Promise.all(requests);

		return Object.assign({
			address: this.connection.address,
		}, ...responses.map(parsers.serverInfo)) as parsers.FServerInfo;
	}

	public async getPlayers(): Promise<parsers.Players> {
		const key = await this.challenge(0x55);

		if(key[0] === 0x44 && key.length > 5){
			return parsers.players(Buffer.from(key), this.connection.meta);
		}

		const command = Buffer.from([
			...BIG_F, 0x55, ...key.slice(1),
		]);
		const response = await this.connection.query(command, 0x44);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.players(response, this.connection.meta);
	}

	public async getRules(): Promise<parsers.Rules>{
		const key = await this.challenge(0x56);

		if(key[0] === 0x45 && key.length > 5){
			return parsers.rules(Buffer.from(key));
		}

		const command = Buffer.from([
			...BIG_F, 0x56, ...key.slice(1),
		]);
		const response = await this.connection.query(command, 0x45);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.rules(response);
	}

	public get lastPing(): number {
		return this.connection === null ? -1 : this.connection.lastPing;
	}

	public async getPing(): Promise<number> {
		if(this.connection.options.enableWarns){
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

	public async challenge(code: number): Promise<number[]> {
		const command = COMMANDS.CHALLENGE();
		if(!CHALLENGE_IDS.includes(this.connection.meta.appID)){
			command[4] = code;
		}

		// 0x41 normal challenge response
		// 0x44 truncated rules response
		// 0x45 truncated players response
		const response = await this.connection.query(command, 0x41, code - 0b10001);

		return Array.from(response);
	}

	public disconnect(): void {
		this.connection.destroy();
	}
}

export default async function init(options: Partial<Options>): Promise<Server> {
	const meta = {};

	// @ts-expect-error meta properties are added later
	const connection = new Connection(await parseOptions(options), meta);
	const info = await _getInfo(connection);
	if(connection.options.debug) debug('SERVER connected');

	Object.assign(meta, {
		info: {
			challenge: info.needsChallenge,
			goldSource: info.goldSource,
		},
		multiPacketResponseIsGoldSource: false,
		appID: info.appID,
		protocol: info.protocol,
	});

	return new Server(connection);
}

export async function getInfo(options: Options): Promise<parsers.FServerInfo> {
	// @ts-expect-error meta properties are innecesary
	const connection = new Connection(await parseOptions(options), {});
	const info = await _getInfo(connection);

	connection.destroy();
	return info;
}

type _ServerInfo = parsers.FServerInfo & {
	needsChallenge: boolean;
};

async function _getInfo(connection: Connection, challenge: Buffer | null = null): Promise<_ServerInfo> {
	const command = challenge === null ?
		COMMANDS.INFO() :
		COMMANDS.INFO(challenge.slice(-4));

	const responses = [];
	connection.awaitResponse([0x6d])
		.then(buf => responses.push(buf))
		.catch(() => { /* do nothing */ });

	const INFO = await connection.query(command, 0x49, 0x41);
	if(INFO[0] === 0x41){
		// needs challenge
		return await _getInfo(connection, INFO);
	}
	responses.push(INFO);

	return Object.assign({
		address: `${connection.options.ip}:${connection.options.port}`,
		needsChallenge: Boolean(challenge),
		ping: connection.lastPing,
	}, ...responses.map(parsers.serverInfo)) as _ServerInfo;
}