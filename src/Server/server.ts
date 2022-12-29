/* eslint-disable new-cap */
import Connection, { responsesHeaders } from './connection';
import * as parsers from './parsers';
import { parseServerOptions, type RawServerOptions, type ServerData } from '../Base/options';
import queries, { COMMANDS } from './base';

const CHALLENGE_IDS = Object.freeze([ 17510, 17520, 17740, 17550, 17700 ]);

type ConnectedServer = Server & { connection: Connection };
export default class Server{
	public data!: ServerData;
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

		this.data = await parseServerOptions(options);
		const connection = new Connection(this.data);
		await connection.connect();

		const info = await queries.getInfo(connection);

		Object.assign(this.data, {
			appID: 'appID' in info ? info.appID : -1,
			protocol: info.protocol,
		});

		this.connection = connection;
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

	public async getInfo(): Promise<parsers.AnyServerInfo> {
		this._shouldBeConnected();
		return await queries.getInfo(this.connection);
	}

	public async getPlayers(): Promise<parsers.Players> {
		this._shouldBeConnected();

		const key = CHALLENGE_IDS.includes(this.data.appID) ?
			await this.challenge() :
			await this.connection.query(COMMANDS.PLAYERS, responsesHeaders.PLAYERS_OR_CHALLENGE);

		if(key[0] === 0x44 && key.length > 5){
			return parsers.players(key, this.data);
		}

		const command = COMMANDS.WITH_KEY.PLAYERS(key.slice(1));
		const response = await this.connection.query(command, responsesHeaders.PLAYERS);

		if(response.equals(key)) throw new Error('Wrong server response');

		return parsers.players(response, this.data);
	}

	public async getRules(): Promise<parsers.Rules> {
		this._shouldBeConnected();

		const key = CHALLENGE_IDS.includes(this.data.appID) ?
			await this.challenge() :
			await this.connection.query(COMMANDS.PLAYERS, responsesHeaders.RULES_OR_CHALLENGE);

		if(key[0] === 0x45 && key.length > 5){
			return parsers.rules(key, this.data);
		}

		const command = COMMANDS.WITH_KEY.RULES(key.slice(1));
		const response = await this.connection.query(command, responsesHeaders.RULES);

		if(response.equals(key)) throw new Error('Wrong server response');

		return parsers.rules(response, this.data);
	}

	private async challenge(): Promise<Buffer> {
		this._shouldBeConnected();
		return await this.connection.query(COMMANDS.CHALLENGE, responsesHeaders.CHALLENGE);
	}

	public static async getInfo(options: RawServerOptions): Promise<parsers.AnyServerInfo> {
		const data = await parseServerOptions(options);
		const connection = new Connection(data);
		await connection.connect();

		const info = await queries.getInfo(connection);
		connection.destroy();
		return info;
	}

	public static async getPlayers(options: RawServerOptions): Promise<parsers.Players> {
		const data = await parseServerOptions(options);
		const connection = new Connection(data);
		await connection.connect();

		const info = await queries.getPlayers(connection);
		connection.destroy();
		return info;
	}

	public static async getRules(options: RawServerOptions): Promise<parsers.Rules> {
		const data = await parseServerOptions(options);
		const connection = new Connection(data);
		await connection.connect();

		const info = await queries.getRules(connection);
		connection.destroy();
		return info;
	}

	public static async init(options: RawServerOptions): Promise<Server> {
		const server = new Server();
		await server.connect(options);
		return server;
	}
}
