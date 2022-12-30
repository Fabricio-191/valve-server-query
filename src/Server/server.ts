/* eslint-disable new-cap */
import Connection, { responsesHeaders } from './connection';
import * as parsers from './parsers';
import { parseServerOptions, type RawServerOptions, type ServerData } from '../Base/options';

const CHALLENGE_IDS = Object.freeze([ 17510, 17520, 17740, 17550, 17700 ]);

function makeCommand(code: number, body: Buffer | number[] = [0xFF, 0xFF, 0xFF, 0xFF]): Buffer {
	return Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, code, ...body]);
}
const INFO_COMMAND = makeCommand(0x54, Buffer.from('Source Engine Query\0'));

export const COMMANDS = {
	INFO: (key?: Buffer): Buffer => {
		if(key) return Buffer.concat([INFO_COMMAND, key]);
		return INFO_COMMAND;
	},
	PLAYERS: 	makeCommand.bind(null, 0x55),
	RULES:   	makeCommand.bind(null, 0x56),
	CHALLENGE: 	makeCommand.bind(null, 0x57),
};

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
		this.connection = new Connection(this.data);
		await this.connection.connect();

		const buffer = await this.connection.makeQuery(COMMANDS.INFO, responsesHeaders.ANY_INFO_OR_CHALLENGE);
		const info = parsers.serverInfo(buffer);

		Object.assign(this.data, {
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

	public async getInfo(): Promise<parsers.AnyServerInfo> {
		this._shouldBeConnected();

		const buffer = await this.connection.makeQuery(COMMANDS.INFO, responsesHeaders.ANY_INFO_OR_CHALLENGE);
		return parsers.serverInfo(buffer);
	}

	public async getPlayers(): Promise<parsers.Players> {
		this._shouldBeConnected();

		const key = CHALLENGE_IDS.includes(this.data.appID) ?
			await this.challenge() :
			await this.connection.query(COMMANDS.PLAYERS(), responsesHeaders.PLAYERS_OR_CHALLENGE);

		if(key[0] === 0x44){
			return parsers.players(key, this.data);
		}

		const command = COMMANDS.PLAYERS(key.subarray(1));
		const response = await this.connection.query(command, responsesHeaders.PLAYERS);

		if(response.equals(key)) throw new Error('Wrong server response');

		return parsers.players(response, this.data);
	}

	public async getRules(): Promise<parsers.Rules> {
		this._shouldBeConnected();

		const key = CHALLENGE_IDS.includes(this.data.appID) ?
			await this.challenge() :
			await this.connection.query(COMMANDS.PLAYERS(), responsesHeaders.RULES_OR_CHALLENGE);

		if(key[0] === 0x45){
			return parsers.rules(key, this.data);
		}

		const command = COMMANDS.RULES(key.subarray(1));
		const response = await this.connection.query(command, responsesHeaders.RULES);

		if(response.equals(key)) throw new Error('Wrong server response');

		return parsers.rules(response, this.data);
	}

	private async challenge(): Promise<Buffer> {
		this._shouldBeConnected();
		return await this.connection.query(COMMANDS.CHALLENGE(), responsesHeaders.CHALLENGE);
	}


	public static getInfo(options: RawServerOptions): Promise<parsers.AnyServerInfo> {
		return Connection.staticQuery(
			options,
			COMMANDS.INFO,
			responsesHeaders.ANY_INFO_OR_CHALLENGE,
			parsers.serverInfo
		);
	}

	public static getPlayers(options: RawServerOptions): Promise<parsers.Players> {
		return Connection.staticQuery(
			options,
			COMMANDS.PLAYERS,
			responsesHeaders.PLAYERS_OR_CHALLENGE,
			parsers.players
		);
	}

	public static getRules(options: RawServerOptions): Promise<parsers.Rules> {
		return Connection.staticQuery(
			options,
			COMMANDS.RULES,
			responsesHeaders.RULES_OR_CHALLENGE,
			parsers.rules
		);
	}

	public static async init(options: RawServerOptions): Promise<Server> {
		const server = new Server();
		await server.connect(options);
		return server;
	}
}
