/* eslint-disable new-cap */
import Connection from './connection';
import * as parsers from './parsers';
import { parseServerOptions, type RawServerOptions, type ServerData } from '../Base/options';

const FFFFFFFF = [0xFF, 0xFF, 0xFF, 0xFF] as const;
export const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ] as const;
export const COMMANDS = {
	INFO_BASE: Buffer.from([
		...FFFFFFFF, 0x54,
		...Buffer.from('Source Engine Query\0'),
	]),
	INFO(key: Buffer | [] = []): Buffer {
		return Buffer.from([ ...COMMANDS.INFO_BASE, ...key ]);
	},
	CHALLENGE(code = 0x57, key = FFFFFFFF): Buffer {
		return Buffer.from([ ...FFFFFFFF, code, ...key ]);
	},
	PING: Buffer.from([ ...FFFFFFFF, 0x69 ]),
};

type AloneServerInfo = parsers.FinalServerInfo & { needsChallenge: boolean };
export async function aloneGetInfo(connection: Connection, challenge: Buffer | null = null): Promise<AloneServerInfo> {
	if(challenge === null){
		await connection.send(COMMANDS.INFO());
	}else{
		await connection.send(COMMANDS.INFO(challenge));
	}

	const responses = [];

	connection.awaitResponse([0x6D])
		.then(data => responses.push(data))
		.catch(() => { /* do nothing */ });

	const INFO = await connection.awaitResponse([0x49, 0x41]);
	if(INFO[0] === 0x41){
		if(challenge !== null){
			throw new Error('Wrong server response');
		}

		// needs challenge
		return await aloneGetInfo(connection, INFO.slice(1));
	}
	responses.push(INFO);

	return Object.assign({
		address: `${connection.data.ip}:${connection.data.port}`,
		needsChallenge: challenge !== null,
	}, ...responses.map(parsers.serverInfo)) as AloneServerInfo;
}

export default class Server{
	public data!: ServerData;
	private connection!: Connection;
	private _isConnected = false;
	public get isConnected(): boolean {
		return this._isConnected;
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

		return Object.assign({}, ...responses.map(parsers.serverInfo)) as parsers.FinalServerInfo;
	}

	public async getPlayers(): Promise<parsers.Players> {
		if(!this._isConnected) throw new Error('Not connected');

		const key = await this.challenge(0x55);

		if(key[0] === 0x44 && key.length > 5){
			return parsers.players(Buffer.from(key), this.data);
		}

		const command = Buffer.from([
			...FFFFFFFF, 0x55, ...key.slice(1),
		]);
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

		const command = Buffer.from([
			...FFFFFFFF, 0x56, ...key.slice(1),
		]);
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
}
