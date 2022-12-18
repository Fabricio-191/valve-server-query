/* eslint-disable no-multi-spaces */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable new-cap */
import Connection from './connection';
import * as parsers from './parsers';
import { parseServerOptions, type RawServerOptions, type ServerData } from '../Base/options';

export const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ] as const;
function makeCommand(code: number, body = '\xFF\xFF\xFF\xFF'): Buffer {
	return Buffer.from(`\xFF\xFF\xFF\xFF${String.fromCharCode(code)}${body}`, 'ascii');
}

export const COMMANDS = {
	INFO: 						 makeCommand(0x54, 'Source Engine Query\0'),
	INFO_WITH_KEY: (key = '') => makeCommand(0x54, `Source Engine Query\0${key}`),
	PLAYERS: (key: string) =>    makeCommand(0x55, key),
	RULES: (key: string) =>      makeCommand(0x56, key),
	CHALLENGE: (code = 0x57) =>  makeCommand(code, ''),
	PING:						 makeCommand(0x69, ''),
};

function attemptToCatchGoldSourceInfo(connection: Connection, responses: Buffer[]): void {
	connection.awaitResponse([0x6D]) // goldsource info
		.then(data => responses.push(data))
		.catch(() => { /* do nothing */ });
}

type AloneServerInfo = parsers.FinalServerInfo & { needsChallenge: boolean };
export async function aloneGetInfo(connection: Connection): Promise<AloneServerInfo> {
	const responses: Buffer[] = [];

	attemptToCatchGoldSourceInfo(connection, responses);

	let needsChallenge = false;
	let INFO = await connection.query(COMMANDS.INFO, 0x49, 0x41); // info or challenge
	if(INFO[0] === 0x41){ // needs challenge
		needsChallenge = true;

		attemptToCatchGoldSourceInfo(connection, responses);

		INFO = await connection.query(
			COMMANDS.INFO_WITH_KEY(INFO.slice(1).toString()),
			0x49
		); // info
	}

	responses.push(INFO);

	return Object.assign({
		needsChallenge,
	}, ...responses.map(parsers.serverInfo)) as AloneServerInfo;
}

export default class Server{
	public data!: ServerData;
	private connection!: Connection;
	private _isConnected = false;
	public get isConnected(): boolean {
		return this._isConnected;
	}

	public get address(): string {
		return this.data.address;
	}

	public async connect(options: RawServerOptions = {}): Promise<this> {
		if(this._isConnected){
			throw new Error('Server: already connected.');
		}

		this.data = await parseServerOptions(options);
		this.connection = new Connection(this.data);
		await this.connection.connect();

		const info = await aloneGetInfo(this.connection);

		Object.assign(this.data, {
			info: {
				challenge: info.needsChallenge,
				goldSource: info.goldSource,
			},
			appID: info.appID,
			protocol: info.protocol,
		});

		this._isConnected = true;
		return this;
	}

	public destroy(): void {
		if(!this._isConnected){
			throw new Error('Not connected');
		}
		this.connection.destroy();
		this._isConnected = false;
	}

	public get lastPing(): number {
		if(!this._isConnected) throw new Error('Not connected');
		return this.connection.lastPing;
	}

	public async getInfo(): Promise<parsers.FinalServerInfo> {
		if(!this._isConnected) throw new Error('Not connected');

		let command = COMMANDS.INFO;
		if(this.data.info.challenge){
			const response = await this.connection.query(command, 0x41);
			const key = response.slice(-4).toString();

			command = COMMANDS.INFO_WITH_KEY(key);
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
		if(!this._isConnected) throw new Error('Not connected');

		const key = await this.challenge(0x55);

		if(key[0] === 0x44 && key.length > 5){
			return parsers.players(Buffer.from(key), this.data);
		}

		const command = COMMANDS.PLAYERS(key.slice(1).toString());
		const response = await this.connection.query(command, 0x44);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.players(response, this.data);
	}

	public async getRules(): Promise<parsers.Rules>{
		if(!this._isConnected) throw new Error('Not connected');

		const key = await this.challenge(0x56);

		if(key[0] === 0x45 && key.length > 5){
			return parsers.rules(Buffer.from(key));
		}

		const command = COMMANDS.RULES(key.slice(1).toString());
		const response = await this.connection.query(command, 0x45);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return parsers.rules(response);
	}

	public async getPing(): Promise<number> {
		if(!this._isConnected) throw new Error('Not connected');

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
		if(!this._isConnected) throw new Error('Not connected');

		// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
		const command = CHALLENGE_IDS.includes(this.data.appID) ?
			COMMANDS.CHALLENGE() :
			COMMANDS.CHALLENGE(code);

		// 0x41 normal challenge response
		// 0x44 truncated rules response
		// 0x45 truncated players response
		return  await this.connection.query(command, 0x41, code - 0b10001);
	}

	public static async getInfo(options: RawServerOptions = {}): Promise<parsers.FinalServerInfo> {
		const server = new Server();
		await server.connect(options);
		const info = await server.getInfo();
		server.destroy();
		return info;
	}
}
