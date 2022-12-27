/* eslint-disable new-cap */
import { ResponsesHeaders } from './connection';
import type Connection from './connection';
import * as parsers from './parsers';
import { delay } from '../Base/utils';

function makeCommand(code: number, body: Array<number> | Buffer = [0xFF, 0xFF, 0xFF, 0xFF]): Buffer {
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

type AloneServerInfo = parsers.FinalServerInfo & { needsChallenge: boolean };

const queries = {
	async getInfo(connection: Connection): Promise<AloneServerInfo> {
		let gldsrcInfo: Buffer | null = null;

		// attempt to catch gold source info
		connection.awaitResponse(ResponsesHeaders.GOLDSOURCE_INFO)
			.then(data => {
				gldsrcInfo = data;
			})
			.catch(() => { /* do nothing */ });

		let needsChallenge = false;
		let info = await connection.query(COMMANDS.INFO, ResponsesHeaders.INFO_OR_CHALLENGE);
		if(info[0] === 0x41){ // needs challenge
			needsChallenge = true;

			info = await connection.query(
				COMMANDS.WITH_KEY.INFO(info.slice(1)),
				ResponsesHeaders.INFO
			); // info
		}

		await delay(100);

		const data = {
			needsChallenge,
			...parsers.serverInfo(info),
		};

		if(gldsrcInfo) Object.assign(data, parsers.serverInfo(gldsrcInfo));

		return data as AloneServerInfo;
	},
	async getPlayers(connection: Connection): Promise<parsers.Players> {
		await connection.mustBeConnected();

		const key = await connection.query(COMMANDS.PLAYERS, ResponsesHeaders.PLAYERS_OR_CHALLENGE);

		if(key[0] === 0x44 && key.length > 5){ // truncated, doesn't need challenge
			return parsers.players(key, connection.data);
		}

		const command = COMMANDS.WITH_KEY.PLAYERS(key.slice(1));
		const response = await connection.query(command, [ 0x44 ]);

		if(response.equals(key)){
			throw new Error('Wrong server response');
		}

		return parsers.players(response, connection.data);
	},
	async getRules(connection: Connection): Promise<parsers.Rules> {
		await connection.mustBeConnected();

		const key = await connection.query(COMMANDS.PLAYERS, ResponsesHeaders.RULES_OR_CHALLENGE);
		if(key[0] === 0x45) return parsers.rules(key);

		const command = COMMANDS.WITH_KEY.RULES(key.slice(1));
		const response = await connection.query(command, ResponsesHeaders.PLAYERS);

		if(response.equals(key)){
			throw new Error('Wrong server response');
		}

		return parsers.rules(response);
	},
};

export default queries;