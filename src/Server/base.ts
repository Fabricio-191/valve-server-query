/* eslint-disable new-cap */
import type Connection from './connection';
import * as parsers from './parsers';

export const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ] as const;
export const COMMANDS = {
	INFO: (key = ''): string => `\xFF\xFF\xFF\xFF\x54Source Engine Query\0${key}`,
	RULES: (key: string): string => `\xFF\xFF\xFF\xFF\x56${key}`,
	PLAYERS: (key: string): string => `\xFF\xFF\xFF\xFF\x55${key}`,
	CHALLENGE: (code = 0x57, key = '\xFF\xFF\xFF\xFF'): string => `\xFF\xFF\xFF\xFF${code}${key}`,
	PING: '\xFF\xFF\xFF\xFF\x69',
};

type AloneServerInfo = parsers.FinalServerInfo & { needsChallenge: boolean };
async function getInfo(connection: Connection): Promise<AloneServerInfo> {
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
			COMMANDS.INFO_WITH_KEY(info.slice(1).toString()),
			0x49
		); // info
	}

	responses.push(info);
	await delay(100);

	return Object.assign({ needsChallenge }, ...responses.map(parsers.serverInfo)) as AloneServerInfo;
}

async function getPlayers(connection: Connection): Promise<parsers.Players> {
	await connection.mustBeConnected();

	const key = await challenge(connection, 0x55);

	if(key[0] === 0x44 && key.length > 5){
		return parsers.players(Buffer.from(key), connection.data);
	}

	const command = COMMANDS.PLAYERS(key.slice(1).toString());
	const response = await connection.query(command, 0x44);

	if(Buffer.compare(response, Buffer.from(key)) === 0){
		throw new Error('Wrong server response');
	}

	return parsers.players(response, connection.data);
}

async function getRules(connection: Connection): Promise<parsers.Rules> {
	await connection.mustBeConnected();

	const key = await challenge(connection, 0x56);

	if(key[0] === 0x45 && key.length > 5){
		return parsers.rules(Buffer.from(key));
	}

	const command = COMMANDS.RULES(key.slice(1).toString());
	const response = await connection.query(command, 0x45);

	if(Buffer.compare(response, Buffer.from(key)) === 0){
		throw new Error('Wrong server response');
	}

	return parsers.rules(response);
}

async function getPing(connection: Connection): Promise<number> {
	await connection.mustBeConnected();

	if(connection.data.enableWarns){
		// eslint-disable-next-line no-console
		console.trace('A2A_PING request is a deprecated feature of source servers');
	}

	try{
		const start = Date.now();
		await connection.query(COMMANDS.PING, 0x6A);

		return Date.now() - start;
	}catch(e){
		return -1;
	}
}

async function challenge(connection: Connection, code: number): Promise<Buffer> {
	await connection.mustBeConnected();

	// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
	const command = CHALLENGE_IDS.includes(connection.data.appID) ?
		COMMANDS.CHALLENGE() :
		COMMANDS.CHALLENGE(code);

	// 0x41 normal challenge response
	// 0x44 truncated rules response
	// 0x45 truncated players response
	return await connection.query(command, 0x41, code - 0b10001);
}

export {
	getInfo,
	getPlayers,
	getRules,
	getPing
};