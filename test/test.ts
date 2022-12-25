/* eslint-disable new-cap */
/* eslint-disable no-console */

import { MasterServer, enableDebug } from '../src';

enableDebug();

MasterServer({
	ip: 'hl2master.steampowered.com:27011',
	region: 'ANY',
	quantity: 20000,
	timeout: 5000,
})
	.then(s => console.log(s.length))
	.catch(console.error);

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
