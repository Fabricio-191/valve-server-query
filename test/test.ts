/* eslint-disable */

// @ts-ignore
import { Server, MasterServer, debug } from '../src';
// @ts-expect-error why-is-node-running has no typings
import * as log from 'why-is-node-running';

debug.enable('./test/debug.log');

function classifyErrors(results: PromiseSettledResult<unknown>[], servers: string[]): void {
	const errors: Record<string, string[]> = {};
	for(let i = 0; i < results.length; i++){
		const info = results[i]!;

		if(info.status === 'rejected'){
			if(!(info.reason.message in errors)){
				errors[info.reason.message] = [];
			}

			errors[info.reason.message]!.push(servers[i]!);
		}
	}

	for(const err in errors) debug(errors[err]!, err);
}

(async () => {
	const filter = new MasterServer.Filter()
		// .is('proxy')
		.any(
			new MasterServer.Filter()
				.appId(10) // Counter-Strike*
				.version('1.1.2.7/Stdio')
				.mod('cstrike')
				// .appId(20) // Team Fortress Classic*
				// .appId(30) // Day of Defeat*
				// .appId(40) // Deathmatch Classic
				// .appId(50) // Half-Life: Opposing Force
				// .appId(60) // Ricochet*
				// .appId(70) // Half-Life*
				// .appId(80) // Counter-Strike: Condition Zero*
				// .appId(130) // Half-Life: Blue Shift
				// .appId(225840) // Sven Co-op
		);

	const servers = await MasterServer({
		timeout: 5000,
		quantity: 3000,
		filter,
	});

	debug(servers, 'servers');

	console.log(servers.length);
	const infos = await Promise.allSettled(servers.map(ip => Server.getInfo({
		ip,
		timeout: 10000,
	})));

	console.log(infos.filter(i => i.status === 'fulfilled').length);
	console.log(infos.filter(i => i.status === 'rejected').length);

	classifyErrors(infos, servers);
})().catch(console.error);

Server.getInfo('62.138.8.167:27018')
	.then(console.log)
	.catch(console.error);

Server.getInfo('85.93.88.112:27015')
	.then(console.log)
	.catch(console.error);

(async () => {
	/*
	const filter = new MasterServer.Filter()
		.appId(4000)
		.is('not_proxy')
		.version('2022.06.08')

	const servers = await MasterServer({
		timeout: 5000,
		quantity: 3000,
		filter,
	});
	*/

	const servers = [
		'208.103.169.104:27015',
		'208.103.169.104:27016',
		'208.103.169.14:27015',
		'208.103.169.33:27023',
		'208.103.169.33:27021',
		'208.103.169.33:27017',
		'208.103.169.33:27015',
		'208.103.169.53:27015',
		'208.103.169.53:27016',
		'208.103.169.16:27015',
		'208.103.169.12:27015',
		'208.103.169.17:27015',
		'208.103.169.33:27024',
		'208.103.169.18:27015',
		'208.103.169.27:27017',
	];

	console.log(servers.length);
	const infos = await Promise.allSettled(servers.map(ip => Server.getPlayers({
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

	debug.save('./test/debug.log');
	setTimeout(() => {
		log();
	}, 5000);
}); // ().catch(console.error);

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
