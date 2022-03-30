import { debug } from '../utils/utils';
import { serverInfo, serverRules, playersInfo } from '../utils/parsers';
import Connection from './connection';

const BIG_F = [0xFF, 0xFF, 0xFF, 0xFF];
const INFO_S = [
	...BIG_F, 0x54,
	...Buffer.from('Source Engine Query\0'),
];

const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ];
const COMMANDS = {
	INFO(key = BIG_F){
		return Buffer.from([ ...INFO_S, ...key ]);
	},
	CHALLENGE(code = 0x57, key = BIG_F){
		return Buffer.from([ ...BIG_F, code, ...key ]);
	},
	PING: Buffer.from([ ...BIG_F, 0x69 ]),
};

const DEFAULT_OPTIONS = {
	ip: 'localhost',
	port: 27015,
	timeout: 5000,
	debug: false,
	enableWarns: true,
}

class Server{
	connection!: Connection | null;

	async getInfo(){
		if(!this.connection) throw new Error('server is not connected to anything');

		let command = COMMANDS.INFO();
		if(this.connection._meta.info.challenge){
			const response = await this.connection.query(command, 0x41);
			const key = response.slice(-4);

			command = COMMANDS.INFO(key);
		}

		const requests = [
			this.connection.query(command, 0x49),
		];

		if(this.connection._meta.info.goldSource) requests.push(
			this.connection.awaitResponse([0x6D]),
		);

		const responses = await Promise.all(requests);

		return Object.assign({
			address: this.connection.options.ip + ':' + this.connection.options.port,
		}, ...responses.map(serverInfo));
	}

	async getPlayers(){
		const key = await this.challenge(0x55);

		if(key[0] === 0x44 && key.length > 5){
			return playersInfo(Buffer.from(key), this.connection._meta);
		}

		const command = Buffer.from([
			...BIG_F, 0x55, ...key.slice(1),
		]);
		const response = await this.connection.query(command, 0x44);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return playersInfo(response, this.connection._meta);
	}

	async getRules(){
		const key = await this.challenge(0x56);

		if(key[0] === 0x45 && key.length > 5){
			return serverRules(Buffer.from(key));
		}

		const command = Buffer.from([
			...BIG_F, 0x56, ...key.slice(1),
		]);
		const response = await this.connection.query(command, 0x45);

		if(Buffer.compare(response, Buffer.from(key)) === 0){
			throw new Error('Wrong server response');
		}

		return serverRules(response);
	}

	get lastPing(){
		return this.connection ? this.connection.lastPing : -1;
	}

	async getPing(){
		if(!this.connection) throw new Error('server is not connected to anything');

		if(this.connection.options.enableWarns){
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

	async challenge(code: number){
		if(!this.connection) throw new Error('server is not connected');

		const command = COMMANDS.CHALLENGE();
		if(!CHALLENGE_IDS.includes(this.connection._meta.appID)){
			command[4] = code;
		}

		// 0x41 normal challenge response
		// 0x44 truncated rules response
		// 0x45 truncated players response
		const response = await this.connection.query(command, 0x41, code - 0b10001);

		return Array.from(response);
	}

	disconnect(){
		this.connection.destroy();
		this.connection = null;
	}
}

export default async function init(options){
	const _meta = {};

	const connection = await createConnection(options, _meta);
	const info = await _getInfo(connection);
	if(connection.options.debug) debug('SERVER', 'connected');

	Object.assign(_meta, {
		info: {
			challenge: info.challenge,
			goldSource: info.goldSource,
		},
		multiPacketResponseIsGoldSource: false,
		appID: info.appID,
		protocol: info.protocol,
	});

	return new Server(connection);
};

export async function getInfo(options): Promise<ServerInfo> {
	const connection = await createConnection(options, {});
	const info = await _getInfo(connection);

	connection.destroy();
	return info;
};

async function _getInfo(connection, challenge?: Buffer): Promise<object> {
	const command = challenge ?
		COMMANDS.INFO(challenge.slice(-4)) :
		COMMANDS.INFO();

	const responses = [];
	connection.awaitResponse([0x6d])
		.then(responses.push)
		.catch(() => {});

	const INFO = await connection.query(command, 0x49, 0x41);
	if(INFO[0] === 0x41){
		// needs challenge
		return await _getInfo(connection, INFO);
	}
	responses.push(INFO);

	return Object.assign({
		address: connection.options.ip + ':' + connection.options.port,
		needsChallenge: Boolean(challenge),
		ping: connection.lastPing,
	}, ...responses.map(serverInfo));
}