/* eslint-disable new-cap */
import type Connection from './connection';
import * as parsers from './parsers';
import { delay } from '../Base/utils';

function makeCommand(code: number, body: Array<number> | Buffer = [0xFF, 0xFF, 0xFF, 0xFF]): Buffer {
	return Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, code, ...body]);
}

export const COMMANDS = {
	INFO_WITH_KEY(key: Buffer): Buffer {
		return Buffer.concat([COMMANDS.INFO, key]);
	},
	PLAYERS(key: Buffer): Buffer {
		return makeCommand(0x55, key);
	},
	RULES(key: Buffer): Buffer {
		return makeCommand(0x56, key);
	},
	INFO: makeCommand(0x54, Buffer.from('Source Engine Query\0')),
	PLAYERS_CHALLENGE: makeCommand(0x55),
	RULES_CHALLENGE: makeCommand(0x56),
	CHALLENGE: makeCommand(0x57),
	PING: makeCommand(0x69, []),
};

/*
enum CommandHeaders {
	INFO = 0x54,
	PLAYERS = 0x55,
	RULES = 0x56,
	CHALLENGE = 0x57,
	PING = 0x69,
}

enum ResponseHeaders {
	INFO = 0x49,
	GOLDSOURCE_INFO = 0x6D,
	PLAYERS = 0x44,
	RULES = 0x45,
	CHALLENGE = 0x41,
	PING = 0x6A,
}
*/

type AloneServerInfo = parsers.FinalServerInfo & { needsChallenge: boolean };

const queries = {
	async getInfo(connection: Connection): Promise<AloneServerInfo> {
		const responses: Buffer[] = [];

		// attempt to catch gold source info
		connection.awaitResponse([0x6D], connection.data.timeout * 1.5) // goldsource info
			.then(data => responses.push(data))
			.catch(() => { /* do nothing */ });

		let needsChallenge = false;
		let info = await connection.query(COMMANDS.INFO, 0x49, 0x41); // info or challenge
		if(info[0] === 0x41){ // needs challenge
			needsChallenge = true;

			info = await connection.query(
				COMMANDS.INFO_WITH_KEY(info.slice(1)),
				0x49
			); // info
		}

		responses.push(info);
		await delay(100);

		return Object.assign({ needsChallenge }, ...responses.map(parsers.serverInfo)) as AloneServerInfo;
	},
	async getPlayers(connection: Connection): Promise<parsers.Players> {
		await connection.mustBeConnected();

		const key = await connection.query(COMMANDS.PLAYERS_CHALLENGE, 0x41, 0x44);

		if(key[0] === 0x44 && key.length > 5){ // truncated, doesn't need challenge
			return parsers.players(key, connection.data);
		}

		const command = COMMANDS.PLAYERS(key.slice(1));
		const response = await connection.query(command, 0x44);

		if(response.equals(key)){
			throw new Error('Wrong server response');
		}

		return parsers.players(response, connection.data);
	},
	async getRules(connection: Connection): Promise<parsers.Rules> {
		await connection.mustBeConnected();

		const key = await connection.query(COMMANDS.PLAYERS_CHALLENGE, 0x41, 0x45);

		if(key[0] === 0x45 && key.length > 5){
			return parsers.rules(key);
		}

		const command = COMMANDS.RULES(key.slice(1));
		const response = await connection.query(command, 0x45);

		if(response.equals(key)){
			throw new Error('Wrong server response');
		}

		return parsers.rules(response);
	},
};

export default queries;