/* eslint-disable new-cap */
// import type { ValueIn } from '../Base/utils';
import { responsesHeaders } from './connection';
import type Connection from './connection';
import * as parsers from './parsers';

function makeCommand(code: number, body: Iterable<number> = [0xFF, 0xFF, 0xFF, 0xFF]): Buffer {
	return Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, code, ...body]);
}

export const COMMANDS = {
	WITH_KEY: {
		INFO: (key: Buffer): Buffer => Buffer.concat([COMMANDS.INFO, key]),
		PLAYERS: makeCommand.bind(null, 0x55),
		RULES:   makeCommand.bind(null, 0x56),
	},
	INFO:      makeCommand(0x54, Buffer.from('Source Engine Query\0')),
	PLAYERS:   makeCommand(0x55),
	RULES:     makeCommand(0x56),
	CHALLENGE: makeCommand(0x57),
	PING:      makeCommand(0x69, []),
};

/*
export const COMMANDS2 = {
	INFO: (key: Buffer): Buffer => Buffer.concat([COMMANDS.INFO, key]),
	PLAYERS: 	makeCommand.bind(null, 0x55),
	RULES:   	makeCommand.bind(null, 0x56),
	CHALLENGE: 	makeCommand.bind(null, 0x57),
};

async function query(
	connection: Connection,
	command: ValueIn<typeof COMMANDS2>,
	responseHeaders: ResponseHeaders
): Promise<Buffer> {
	await connection.mustBeConnected();

	let buffer = await connection.query(command([]), responseHeaders);
	let attempt = 0;

	while(buffer[0] === 0x41 && attempt < 5){
		buffer = await connection.query(
			command(buffer.subarray(1)),
			responseHeaders
		);
		attempt++;
	}

	if(buffer[0] === 0x41) throw new Error('Wrong server response');

	return buffer;
}

*/

const queries = {
	async getInfo(connection: Connection): Promise<parsers.AnyServerInfo> {
		await connection.mustBeConnected();

		let info = await connection.query(COMMANDS.INFO, responsesHeaders.ANY_INFO_OR_CHALLENGE);

		let attempt = 0;
		while(info[0] === 0x41 && attempt !== 5){ // needs challenge
			info = await connection.query(
				COMMANDS.WITH_KEY.INFO(info.subarray(1)),
				responsesHeaders.ANY_INFO_OR_CHALLENGE
			);

			attempt++;
		}

		if(info[0] === 0x41) throw new Error('Wrong server response');

		const data: parsers.AnyServerInfo = parsers.serverInfo(info);

		try{ // attempt to catch other info
			const responseHeader = data.goldSource ? responsesHeaders.INFO : responsesHeaders.GLDSRC_INFO;
			const otherInfo = await connection.awaitResponse(responseHeader, 500);

			Object.assign(data, parsers.serverInfo(otherInfo));
		}catch{ /* do nothing */ }

		return data;
	},
	async getPlayers(connection: Connection): Promise<parsers.Players> {
		await connection.mustBeConnected();

		const key = await connection.query(COMMANDS.PLAYERS, responsesHeaders.PLAYERS_OR_CHALLENGE);
		if(key[0] === 0x44) return parsers.players(key, connection.data);

		const command = COMMANDS.WITH_KEY.PLAYERS(key.subarray(1));
		const response = await connection.query(command, responsesHeaders.PLAYERS);

		if(response.equals(key)){
			throw new Error('Wrong server response');
		}

		return parsers.players(response, connection.data);
	},
	async getRules(connection: Connection): Promise<parsers.Rules> {
		await connection.mustBeConnected();

		const key = await connection.query(COMMANDS.PLAYERS, responsesHeaders.RULES_OR_CHALLENGE);
		if(key[0] === 0x45) return parsers.rules(key, connection.data);

		const command = COMMANDS.WITH_KEY.RULES(key.subarray(1));
		const response = await connection.query(command, responsesHeaders.PLAYERS);

		if(response.equals(key)){
			throw new Error('Wrong server response');
		}

		return parsers.rules(response, connection.data);
	},
};

export default queries;