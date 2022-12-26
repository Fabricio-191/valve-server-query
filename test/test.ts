/* eslint-disable new-cap */
/* eslint-disable no-console */

import { debug } from '../src';

debug.enable('./test/debug.log');

debug({}, 'Hello world!');

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
