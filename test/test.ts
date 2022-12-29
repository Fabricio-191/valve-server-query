/* eslint-disable new-cap */
/* eslint-disable no-console */

// eslint-disable-next-line
// @ts-ignore
// eslint-disable-next-line
import { Server, MasterServer, debug } from '../src';

debug.enable('./test/debug.log');

(async () => {
	/*
		const filter = new MasterServer.Filter()
		.is('proxy');
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

		const servers = await MasterServer({
			timeout: 5000,
			quantity: 3000,
			filter,
		});

	*/
	const servers = [
		'51.161.198.60:28922',
		'51.161.198.59:28409',
		'51.161.198.59:28415',
	  ];

	console.log(servers.length);
	const infos = await Promise.allSettled(servers.map(add => Server.getInfo({
		ip: add,
		timeout: 30000,
	})));

	console.log(infos.filter(i => i.status === 'fulfilled').length);
	console.log(infos.filter(i => i.status === 'rejected').length);

	const errors: Record<string, string[]> = {};
	for(let i = 0; i < infos.length; i++){
		const info = infos[i]!;
		const server = servers[i]!;

		if(info.status === 'rejected'){
			if(!(info.reason.message in errors)){
				errors[info.reason.message] = [];
			}

			errors[info.reason.message]!.push(server);
		}
	}

	for(const err in errors){
		debug(errors[err]!, err);
	}
})().catch(console.error);

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
