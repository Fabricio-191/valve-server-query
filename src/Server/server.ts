/* eslint-disable new-cap */
import { debug, parseOptions, type RawOptions } from '../utils';
import Connection from './connection';
import * as parsers from './serverParsers';

const BIG_F = [0xFF, 0xFF, 0xFF, 0xFF] as const;
const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ] as const;
const COMMANDS = {
	INFO_BASE: Buffer.from([
		...BIG_F, 0x54,
		...Buffer.from('Source Engine Query\0'),
	]),
	INFO(key: Buffer | [] = []){
		return Buffer.from([ ...COMMANDS.INFO_BASE, ...key ]);
	},
	CHALLENGE(code = 0x57, key = BIG_F){
		return Buffer.from([ ...BIG_F, code, ...key ]);
	},
	PING: Buffer.from([ ...BIG_F, 0x69 ]),
};

export default class Server{
	private connection: Connection | null = null;

	public async getInfo(): Promise<parsers.FinalServerInfo> {
		if(this.connection === null){
			throw new Error('Not connected');
		}

		let command = COMMANDS.INFO();
		if(this.connection.meta.info.challenge){
			const response = await this.connection.query(command, 0x41);
			const key = response.slice(-4);

			command = COMMANDS.INFO(key);
		}

		const requests = this.connection.meta.info.goldSource ? [
			this.connection.query(command, 0x49),
			this.connection.awaitResponse([0x6D]),
		] : [
			this.connection.query(command, 0x49),
		];

		const responses = await Promise.all(requests);

		return Object.assign(
			{
				address: this.connection.address,
			},
			...responses.map(parsers.serverInfo)
		) as parsers.FinalServerInfo;
	}

	public async getPlayers(): Promise<parsers.Players> {
		if(this.connection === null){
			throw new Error('Not connected');
		}

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
		if(this.connection === null){
			throw new Error('Not connected');
		}

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
		if(this.connection === null){
			throw new Error('Not connected');
		}

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

	public async challenge(code: number): Promise<Buffer> {
		if(this.connection === null){
			throw new Error('Not connected');
		}

		const command = COMMANDS.CHALLENGE();
		// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
		if(!CHALLENGE_IDS.includes(this.connection.meta.appID)){
			command[4] = code;
		}

		// 0x41 normal challenge response
		// 0x44 truncated rules response
		// 0x45 truncated players response
		const response = await this.connection.query(command, 0x41, code - 0b10001);

		return response;
	}

	public disconnect(): void {
		if(this.connection !== null){
			this.connection.destroy();
		}
	}

	public async connect(options: RawOptions): Promise<void> {
		const connection = new Connection(
			await parseOptions(options),
			// @ts-expect-error missing meta properties are added below
			{}
		);
		const info = await _getInfo(connection);
		if(connection.options.debug) debug('SERVER connected');

		connection.meta = {
			info: {
				challenge: info.needsChallenge,
				goldSource: info.goldSource,
			},
			multiPacketGoldSource: false,
			appID: info.appID,
			protocol: info.protocol,
		};

		this.connection = connection;
	}

	public static async getInfo(options: RawOptions): Promise<parsers.FinalServerInfo> {
		const connection = new Connection(
			await parseOptions(options),
			// @ts-expect-error meta is not needed
			{}
		);
		const info = await _getInfo(connection);

		connection.destroy();
		return info;
	}
}

type _ServerInfo = parsers.FinalServerInfo & {
	needsChallenge: boolean;
};

async function _getInfo(connection: Connection, challenge: Buffer | null = null): Promise<_ServerInfo> {
	if(challenge === null){
		await connection.send(COMMANDS.INFO());
	}else{
		await connection.send(COMMANDS.INFO(challenge));
	}

	const responses = [];

	connection.awaitResponse([0x6d])
		.then(data => responses.push(data))
		.catch(() => { /* do nothing */ });

	const INFO = await connection.awaitResponse([0x49, 0x41]);
	if(INFO[0] === 0x41){
		if(challenge !== null){
			throw new Error('Wrong server response');
		}

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
