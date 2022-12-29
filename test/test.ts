/* eslint-disable */

// @ts-ignore
import { Server, MasterServer, debug } from '../src';

debug.enable('./test/debug.log');

(async () => {
	const filter = new MasterServer.Filter()
		// .is('proxy')
		.any(
			new MasterServer.Filter()
				/*
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
				*/
				.appId(17510)
				.appId(17520)
				.appId(17740)
				.appId(17550)
				.appId(17700)
		);

	const servers = await MasterServer({
		timeout: 5000,
		quantity: 3000,
		filter,
	});

	console.log(servers.length);
	const infos = await Promise.allSettled(servers.map(ip => Server.getInfo({
		ip,
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

	for(const err in errors) debug(errors[err]!, err);
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
