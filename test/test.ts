/* eslint-disable new-cap */
/* eslint-disable no-console */

export const CHALLENGE_IDS = [ 17510, 17520, 17740, 17550, 17700 ] as const;
export const COMMANDS = {
	INFO: (key = ''): string => `\xFF\xFF\xFF\xFF\x54Source Engine Query\0${key}`,
	CHALLENGE: (code = 0x57, key = '\xFF\xFF\xFF\xFF'): string => `\xFF\xFF\xFF\xFF${code}${key}`,
	PING: '\xFF\xFF\xFF\xFF\x69',
};

/*
import { RCON } from '../src';

const options = {
	ip: '49.12.122.244:33008',
	password: 'cosas',

	enableWarns: false,
	debug: true,
};

const rcon = new RCON();

rcon.connect(options)
	.catch(console.error);

rcon.exec('status')
	.then(console.log)
	.catch(console.error);
*/