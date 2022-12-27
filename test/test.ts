/* eslint-disable new-cap */
/* eslint-disable no-console */

// eslint-disable-next-line
// @ts-ignore
import { Server, MasterServer, debug } from '../src';

debug.enable('./test/debug.log');

const filter = new MasterServer.Filter()
	.is('proxy')
	.any(
		new MasterServer.Filter()
			.appId(10) // Counter-Strike*
			.appId(20) // Team Fortress Classic*
			.appId(30) // Day of Defeat*
			.appId(40) // Deathmatch Classic
			.appId(50) // Half-Life: Opposing Force
			.appId(60) // Ricochet*
			.appId(70) // Half-Life*
			.appId(80) // Counter-Strike: Condition Zero*
			.appId(130) // Half-Life: Blue Shift
			.appId(225840) // Sven Co-op
	);

MasterServer({
	timeout: 5000,
	quantity: 3000,
	filter,
})
	.then(async servers => {
		console.log(servers.length);
		const infos = await Promise.allSettled(servers.map(add => Server.getInfo({
			ip: add,
			timeout: 60000,
		})));

		console.log(infos.filter(i => i.status === 'fulfilled').length);
		console.log(infos.filter(i => i.status === 'rejected').length);

		const rejected = [];
		for(let i = 0; i < infos.length; i++){
			const info = infos[i]!;
			const server = servers[i];

			if(info.status === 'rejected' && info.reason.message !== 'Response timeout.') console.log(server, info.reason);
			if(info.status === 'rejected') rejected.push(server);
		}
		debug(rejected, 'Timeouts');
		// @ts-expect-error asdasd
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		debug(infos.filter(i => i.status === 'fulfilled').map(x => x.value), 'Infos');
	})
	.catch(console.error);

/*
Server.getInfo('20.205.10.52:27020')
	.then(console.log)
	.catch(console.error);

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
