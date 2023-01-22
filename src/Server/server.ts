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
	constructor(options?: RawServerOptions){
		if(options) this.setOptions(options);
	}
	private _isTheShip: boolean | null = null;
	private readonly connection: Connection = new Connection();

	public setOptions(options: RawServerOptions = {}): void {
		const parsedOptions = parseServerOptions(options);
		this.connection.data = parsedOptions;
	}

	public destroy(): void {
		this.connection.destroy();
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

		return info;
	}

	public async getPlayers(): Promise<parsers.Players> {
		if(this._isTheShip === null){
			const info = await this.getInfo();
			this._isTheShip = '_isTheShip' in info && info._isTheShip;
		}

		const buffer = await this._makeQuery(COMMANDS.PLAYERS, responsesHeaders.PLAYERS_OR_CHALLENGE);
		return parsers.players(buffer, this._isTheShip);
	}

	public async getRules(): Promise<parsers.Rules> {
		const buffer = await this._makeQuery(COMMANDS.RULES, responsesHeaders.RULES_OR_CHALLENGE);
		return parsers.rules(buffer);
	}

	public get address(): string {
		return `${this.connection.data.ip}:${this.connection.data.port}`;
	}

	public get lastPing(): number {
		return this.connection ? this.connection._lastPing : -1;
	}

	public static async getInfo(options: RawServerOptions): Promise<InfoWithPing> {
		const server = new Server(options);
		const info = await server.getInfo();

		server.destroy();
		return info;
	}

	public static async getPlayers(options: RawServerOptions): Promise<parsers.Players> {
		const server = new Server(options);
		const players = await server.getPlayers();

		server.destroy();
		return players;
	}

	public static async getRules(options: RawServerOptions): Promise<parsers.Rules> {
		const server = new Server(options);
		const rules = await server.getRules();

		server.destroy();
		return rules;
	}

	public static bulkQuery = bulkQuery;
}

interface BulkQueryResult {
	address: string;
	info: InfoWithPing | { error: unknown };
	players?: parsers.Players | { error: unknown };
	rules?: parsers.Rules | { error: unknown };
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

			server.destroy();
		}

		return result;
	};

	servers = servers.map(x => {
		if(typeof x === 'string') return { ip: x };
		x.timeout ??= options.timeout ?? 5000;

		return x;
	});

	const results: BulkQueryResult[] = [];
	const step = options.chunkSize ?? 5000;

	for(let i = 0; i < servers.length; i += step){
		const chunk = servers.slice(i, i + step).map(_query);
		results.push(...await Promise.all(chunk));
	}

	return results;
}