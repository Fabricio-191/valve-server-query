/* eslint-disable new-cap */
import Connection, { responsesHeaders } from './connection';
import * as parsers from './parsers';
import { type RawServerOptions } from '../Base/options';
import { exec } from 'child_process';

function makeCommand(code: number, body: Buffer | number[] = [0xFF, 0xFF, 0xFF, 0xFF]): Buffer {
	return Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, code, ...body]);
}

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
	const info: parsers.AnyServerInfo = parsers.serverInfo(buffer, connection.data);

	try{
		const otherHeader = buffer[0] === 0x49 ? responsesHeaders.GLDSRC_INFO : responsesHeaders.INFO;
		const otherBuffer = await connection.awaitResponse(otherHeader, 500);

		Object.assign(info, parsers.serverInfo(otherBuffer, connection.data));
	}catch{}

	return info;
}

type ConnectedServer = Server & { connection: Connection };
export default class Server{
	public connection: Connection | null = null;

	public isConnected(): this is ConnectedServer {
		return this.connection !== null;
	}

	private _shouldBeConnected(): asserts this is ConnectedServer {
		if(!this.isConnected()) throw new Error('Not connected');
	}

	public async connect(options: RawServerOptions = {}): Promise<this> {
		if(this.isConnected()){
			throw new Error('Server: already connected.');
		}

		this.connection = await Connection.init(options);

		const info = await getInfo(this.connection);

		Object.assign(this.connection.data, {
			appID: 'appID' in info ? info.appID : -1,
			protocol: info.protocol,
		});

		return this;
	}

	public destroy(): void {
		if(!this.connection) throw new Error('Not connected');
		this.connection.destroy();
		this.connection = null;
	}

	public get lastPing(): number {
		this._shouldBeConnected();
		return this.connection.lastPing;
	}

	public get data(): Connection['data'] {
		this._shouldBeConnected();
		return this.connection.data;
	}

	public async getInfo(): Promise<parsers.AnyServerInfo> {
		this._shouldBeConnected();
		return await getInfo(this.connection);
	}

	public async getPlayers(): Promise<parsers.Players> {
		this._shouldBeConnected();

		const buffer = await this.connection.makeQuery(COMMANDS.PLAYERS, responsesHeaders.PLAYERS_OR_CHALLENGE);
		return parsers.players(buffer, this.data);
	}

	public async getRules(): Promise<parsers.Rules> {
		this._shouldBeConnected();

		const buffer = await this.connection.makeQuery(COMMANDS.RULES, responsesHeaders.RULES_OR_CHALLENGE);
		return parsers.rules(buffer, this.data);
	}

	public static async getInfo(options: RawServerOptions): Promise<parsers.AnyServerInfo> {
		const connection = await Connection.init(options);
		const info = await getInfo(connection);

		connection.destroy();
		return info;
	}

	public static async getPlayers(options: RawServerOptions): Promise<parsers.Players> {
		const connection = await Connection.init(options);

		const buffer = await connection.makeQuery(COMMANDS.PLAYERS, responsesHeaders.PLAYERS_OR_CHALLENGE);

		connection.destroy();
		return parsers.players(buffer, connection.data);
	}

	public static async getRules(options: RawServerOptions): Promise<parsers.Rules> {
		const connection = await Connection.init(options);

		const buffer = await connection.makeQuery(COMMANDS.RULES, responsesHeaders.RULES_OR_CHALLENGE);

		connection.destroy();
		return parsers.rules(buffer, connection.data);
	}

	public static async init(options: RawServerOptions): Promise<Server> {
		const server = new Server();
		await server.connect(options);
		return server;
	}

	public static getPing(address: string): Promise<number> {
		return new Promise((resolve, reject) => {
			const start = Date.now();
			exec(`ping ${address}`, {
				windowsHide: true,
			}, err => {
				if(err) return reject(err);
				resolve(Date.now() - start);
			});
		});
	}
}
