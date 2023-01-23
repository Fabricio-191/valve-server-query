/* eslint-disable new-cap */
import Connection from './connection';
import * as parsers from './parsers';
import { type RawServerOptions, parseServerOptions } from '../Base/options';

function makeCommand(code: number, body: Buffer | number[] = [0xFF, 0xFF, 0xFF, 0xFF]): Buffer {
	return Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, code, ...body]);
}

const responsesHeaders = {
	ANY_INFO_OR_CHALLENGE: [0x6D, 0x49, 0x41],
	INFO: [0x49],
	GLDSRC_INFO: [0x6D],
	PLAYERS_OR_CHALLENGE: [0x44, 0x41],
	RULES_OR_CHALLENGE: [0x45, 0x41],
} as const;

const COMMANDS = {
	_INFO: makeCommand(0x54, Buffer.from('Source Engine Query\0')),
	INFO: (key?: Buffer): Buffer => {
		if(key) return Buffer.concat([COMMANDS._INFO, key]);
		return COMMANDS._INFO;
	},
	PLAYERS: makeCommand.bind(null, 0x55),
	RULES:   makeCommand.bind(null, 0x56),
};

type InfoWithPing = parsers.AnyServerInfo & { ping: number };

export default class Server{
	constructor(options: RawServerOptions = {}){
		const parsedOptions = parseServerOptions(options);
		this.connection = new Connection(parsedOptions);
	}
	private _isTheShip: boolean | null = null;
	private readonly connection: Connection;

	public destroy(): Promise<void> {
		return this.connection.destroy();
	}

	private async _makeQuery(command: (key?: Buffer) => Buffer, responseHeaders: readonly number[]): Promise<Buffer> {
		let buffer = await this.connection.query(command(), responseHeaders);
		let attempt = 0;

		while(buffer[0] === 0x41 && attempt < 15){
			buffer = await this.connection.query(command(buffer.subarray(1)), responseHeaders);
			attempt++;
		}

		if(buffer[0] === 0x41) throw new Error('Wrong server response');

		return buffer;
	}

	public async getInfo(): Promise<InfoWithPing> {
		const buffer = await this._makeQuery(COMMANDS.INFO, responsesHeaders.ANY_INFO_OR_CHALLENGE);
		// @ts-expect-error ping is added later
		const info: InfoWithPing = parsers.serverInfo(buffer);
		info.ping = this.connection._lastPing;

		try{
			const otherHeader = buffer[0] === 0x49 ? responsesHeaders.GLDSRC_INFO : responsesHeaders.INFO;
			const otherBuffer = await this.connection.awaitResponse(otherHeader, 500);

			Object.assign(info, parsers.serverInfo(otherBuffer));
		}catch{}

		this._isTheShip = '_isTheShip' in info && info._isTheShip;

		return info;
	}

	public async getPlayers(): Promise<parsers.Players> {
		if(this._isTheShip === null) await this.getInfo();

		const buffer = await this._makeQuery(COMMANDS.PLAYERS, responsesHeaders.PLAYERS_OR_CHALLENGE);
		return parsers.players(buffer, this._isTheShip!);
	}

	public async getRules(): Promise<parsers.Rules> {
		const buffer = await this._makeQuery(COMMANDS.RULES, responsesHeaders.RULES_OR_CHALLENGE);
		return parsers.rules(buffer);
	}

	public get address(): string {
		return `${this.connection.data.ip}:${this.connection.data.port}`;
	}

	public get lastPing(): number {
		return this.connection._lastPing;
	}

	public static async getInfo(options: RawServerOptions): Promise<InfoWithPing> {
		const server = new Server(options);
		const info = await server.getInfo();

		await server.destroy();
		return info;
	}

	public static async getPlayers(options: RawServerOptions): Promise<parsers.Players> {
		const server = new Server(options);
		const players = await server.getPlayers();

		await server.destroy();
		return players;
	}

	public static async getRules(options: RawServerOptions): Promise<parsers.Rules> {
		const server = new Server(options);
		const rules = await server.getRules();

		await server.destroy();
		return rules;
	}

	public static bulkQuery = bulkQuery;
}

interface BulkQueryResult {
	address: string;
	info: InfoWithPing | { error: string };
	players?: parsers.Players | { error: string };
	rules?: parsers.Rules | { error: string };
}

interface BulkQueryOptions {
	getPlayers?: boolean;
	getRules?: boolean;
	chunkSize?: number;
	timeout?: number;
}

const _handleError = (error: Error | string): { error: string } => ({
	error: error instanceof Error ? error.message : error,
});

async function bulkQuery(servers: RawServerOptions[], options: BulkQueryOptions = {}): Promise<BulkQueryResult[]> {
	const _query = async (opts: RawServerOptions): Promise<BulkQueryResult> => {
		const server = new Server(opts);
		const info = await server.getInfo()
			.catch(_handleError);

		const result: BulkQueryResult = {
			address: server.address,
			info,
		};

		if(!('error' in info)){
			if(options.getPlayers) result.players = await server.getPlayers()
				.catch(_handleError);
			if(options.getRules) result.rules = await server.getRules()
				.catch(_handleError);
		}

		await server.destroy();
		return result;
	};

	servers = servers.map(opts => {
		if(typeof opts === 'string') opts = { ip: opts };
		opts.timeout ??= options.timeout ?? 5000;

		return opts;
	});

	const results: BulkQueryResult[] = Array<BulkQueryResult>(servers.length);
	const step = options.chunkSize ?? 3000;

	for(let i = 0; i < servers.length; i += step){
		const chunk = await Promise.all(servers.slice(i, i + step).map(_query));
		for(let j = 0; j < chunk.length; j++){
			results[i + j] = chunk[j]!;
		}
	}

	return results;
}