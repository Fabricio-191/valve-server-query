/* eslint-disable new-cap */
/* eslint-disable no-console */
import { MasterServer } from '../src';

const filter = new MasterServer.Filter()
	.any(
		new MasterServer.Filter()
			.address('131.221.33.149')
			.address('168.195.128.62')
	);

MasterServer({ filter })
	.then(console.log)
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