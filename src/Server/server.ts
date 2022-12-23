/* eslint-disable new-cap */
import Connection from './connection';
import * as parsers from './parsers';
import { parseServerOptions, type RawServerOptions, type ServerData } from '../Base/options';
import queries, { COMMANDS } from './base';

const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ] as const;

type ConnectedServer = Server & { connection: Connection };
export default class Server{
	public data!: ServerData;
	public connection: Connection | null = null;

	public isConnected(): this is ConnectedServer {
		return this.connection !== null;
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
			info: {
				challenge: info.needsChallenge,
				goldSource: info.goldSource,
			},
			appID: info.appID,
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
		if(!this.isConnected()) throw new Error('Not connected');
		return this.connection.lastPing;
	}

	public async getInfo(): Promise<parsers.FinalServerInfo> {
		if(!this.isConnected()) throw new Error('Not connected');

		let command = COMMANDS.INFO;
		if(this.data.info.challenge){
			const response = await this.connection.query(command, 0x41);
			command = COMMANDS.INFO_WITH_KEY(response.slice(1));
		}

		const requests = this.data.info.goldSource ? [
			this.connection.query(command, 0x49),
			this.connection.awaitResponse([0x6D]),
		] : [
			this.connection.query(command, 0x49),
		];

		const responses = await Promise.all(requests);

		return Object.assign({}, ...responses.map(parsers.serverInfo)) as parsers.FinalServerInfo;
	}

	public async getPlayers(): Promise<parsers.Players> {
		if(!this.isConnected()) throw new Error('Not connected');

		// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
		const key = CHALLENGE_IDS.includes(this.data.appID) ?
			await this.challenge() :
			await this.connection.query(COMMANDS.PLAYERS_CHALLENGE, 0x41, 0x44);

		if(key[0] === 0x44 && key.length > 5){
			return parsers.players(key, this.data);
		}

		const command = COMMANDS.PLAYERS(key.slice(1));
		const response = await this.connection.query(command, 0x44);

		if(response.equals(key)) throw new Error('Wrong server response');

		return parsers.players(response, this.data);
	}

	public async getRules(): Promise<parsers.Rules> {
		if(!this.isConnected()) throw new Error('Not connected');

		// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
		const key = CHALLENGE_IDS.includes(this.data.appID) ?
			await this.challenge() :
			await this.connection.query(COMMANDS.PLAYERS_CHALLENGE, 0x41, 0x45);

		if(key[0] === 0x45 && key.length > 5){
			return parsers.rules(key);
		}

		const command = COMMANDS.RULES(key.slice(1));
		const response = await this.connection.query(command, 0x45);

		if(response.equals(key)) throw new Error('Wrong server response');

		return parsers.rules(response);
	}

	private async challenge(): Promise<Buffer> {
		if(!this.isConnected()) throw new Error('Not connected');
		return await this.connection.query(COMMANDS.CHALLENGE, 0x41);
	}

	public static async getInfo(options: RawServerOptions): Promise<parsers.FinalServerInfo> {
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
}
