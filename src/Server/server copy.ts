/* eslint-disable new-cap */
import Connection from './connection';
import * as parsers from './parsers';
import { type ServerData, type RawServerOptions, parseServerOptions } from '../Base/options';

function makeCommand(code: number, body: Buffer | number[] = [0xFF, 0xFF, 0xFF, 0xFF]): Buffer {
	return Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, code, ...body]);
}

const responsesHeaders = {
	ANY_INFO_OR_CHALLENGE: [0x6D, 0x49, 0x41],
	INFO: [0x49],
	GLDSRC_INFO: [0x6D],
	PLAYERS_OR_CHALLENGE: [0x44, 0x41],
	RULES_OR_CHALLENGE: [0x45, 0x41],
};

const COMMANDS = {
	_INFO: makeCommand(0x54, Buffer.from('Source Engine Query\0')),
	INFO: (key?: Buffer): Buffer => {
		if(key) return Buffer.concat([COMMANDS._INFO, key]);
		return COMMANDS._INFO;
	},
	PLAYERS: 	makeCommand.bind(null, 0x55),
	RULES:   	makeCommand.bind(null, 0x56),
};

const connections = new Map<string, Connection>();
async function getConnection(options: ServerData): Promise<Connection> {
	if(connections.has(options.address)) return connections.get(options.address)!;

	const connection = await Connection.init(options);
	connections.set(options.address, connection);
	connection.info = await _getInfo(connection);

	return connection;
}

async function getOptions(options: RawServerOptions[]): Promise<ServerData> {
	const data = await parseServerOptions(Object.assign({}, ...options));
	return data;
}

async function _getInfo(connection: Connection): Promise<parsers.AnyServerInfo> {
	const buffer = await connection.makeQuery(COMMANDS.INFO, responsesHeaders.ANY_INFO_OR_CHALLENGE);
	const info: parsers.AnyServerInfo = parsers.serverInfo(buffer, connection.data);

	try{
		const otherHeader = buffer[0] === 0x49 ? responsesHeaders.GLDSRC_INFO : responsesHeaders.INFO;
		const otherBuffer = await connection.awaitResponse(otherHeader, 500);

		Object.assign(info, parsers.serverInfo(otherBuffer, connection.data));
	}catch{}

	return info;
}

const queries = {
	async getInfo(...options: RawServerOptions[]): Promise<parsers.AnyServerInfo> {
		const data = await getOptions(options);
		const connection = await getConnection(data);

		const info = await _getInfo(connection);

		return info;
	},
	async getPlayers(...options: RawServerOptions[]): Promise<parsers.Players> {
		const data = await getOptions(options);
		const connection = await getConnection(data);

		const buffer = await connection.makeQuery(COMMANDS.PLAYERS, responsesHeaders.PLAYERS_OR_CHALLENGE);

		connection.destroy();
		return parsers.players(buffer, connection.data);
	},
	async getRules(...options: RawServerOptions[]): Promise<parsers.Rules> {
		const data = await getOptions(options);
		const connection = await getConnection(data);

		const buffer = await connection.makeQuery(COMMANDS.RULES, responsesHeaders.RULES_OR_CHALLENGE);

		connection.destroy();
		return parsers.rules(buffer, connection.data);
	},
	async getPing(...options: RawServerOptions[]): Promise<number> {
		const data = await getOptions(options);
		const connection = await getConnection(data);

		const start = Date.now();
		await connection.ping();
		const ping = Date.now() - start;

		connection.destroy();
		return ping;
	},

};

export default queries;