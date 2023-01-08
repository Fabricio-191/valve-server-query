/* eslint-disable new-cap */
import Connection from './connection';
import * as parsers from './parsers';
import type { RawServerOptions } from '../Base/options';

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
	PLAYERS: 	makeCommand.bind(null, 0x55),
	RULES:   	makeCommand.bind(null, 0x56),
};

async function getInfo(connection: Connection): Promise<parsers.AnyServerInfo> {
	const buffer = await connection.makeQuery(COMMANDS.INFO, responsesHeaders.ANY_INFO_OR_CHALLENGE);
	const info: parsers.AnyServerInfo = parsers.serverInfo(buffer);

	try{
		const otherHeader = buffer[0] === 0x49 ? responsesHeaders.GLDSRC_INFO : responsesHeaders.INFO;
		const otherBuffer = await connection.awaitResponse(otherHeader, 500);

		Object.assign(info, parsers.serverInfo(otherBuffer));
	}catch{}

	return info;
}

export default class Server{
	public _connected: Promise<parsers.AnyServerInfo> | false = false;
	public connection: Connection | null = null;

	private async _mustBeConnected(): Promise<void> {
		if(this._connected) await this._connected;
		else throw new Error('Not connected');
	}

	public async connect(options: RawServerOptions = {}): Promise<parsers.AnyServerInfo> {
		if(this._connected){
			throw new Error('Server: already connected.');
		}

		this._connected = (async () => {
			this.connection = await Connection.init(options);
			const info = await getInfo(this.connection);

			Object.assign(this.connection.data, {
				appID: 'appID' in info ? info.appID : -1,
				protocol: info.protocol,
			});

			return info;
		})();

		return await this._connected;
	}

	public destroy(): void {
		if(!this.connection) throw new Error('Not connected');
		this.connection.destroy();
		this.connection = null;
	}

	public async getInfo(): Promise<parsers.AnyServerInfo> {
		await this._mustBeConnected();
		return await getInfo(this.connection!);
	}

	public async getPlayers(): Promise<parsers.Players> {
		await this._mustBeConnected();

		const buffer = await this.connection!.makeQuery(COMMANDS.PLAYERS, responsesHeaders.PLAYERS_OR_CHALLENGE);
		return parsers.players(buffer, this.connection!.data);
	}

	public async getRules(): Promise<parsers.Rules> {
		await this._mustBeConnected();

		const buffer = await this.connection!.makeQuery(COMMANDS.RULES, responsesHeaders.RULES_OR_CHALLENGE);
		return parsers.rules(buffer);
	}

	public static async getInfo(options: RawServerOptions): Promise<parsers.AnyServerInfo> {
		const connection = await Connection.init(options);
		const info = await getInfo(connection);

		connection.destroy();
		return info;
	}

	public static async init(options: RawServerOptions): Promise<Server> {
		const server = new Server();
		await server.connect(options);
		return server;
	}
}