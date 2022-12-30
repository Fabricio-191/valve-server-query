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
		const server = servers[i]!;

		if(info.status === 'rejected'){
			if(!(info.reason.message in errors)){
				errors[info.reason.message] = [];
			}

			errors[info.reason.message]!.push(server);
		}
	}

	for(const err in errors) debug(errors[err]!, err);
}

(async () => {
	/*
	const filter = new MasterServer.Filter()
		// .is('proxy')
		.any(
			new MasterServer.Filter()
				// .appId(10) // Counter-Strike*
				// .appId(20) // Team Fortress Classic*
				// .appId(30) // Day of Defeat*
				// .appId(40) // Deathmatch Classic
				// .appId(50) // Half-Life: Opposing Force
				// .appId(60) // Ricochet*
				// .appId(70) // Half-Life*
				// .appId(80) // Counter-Strike: Condition Zero*
				// .appId(130) // Half-Life: Blue Shift
				// .appId(225840) // Sven Co-op
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
	*/

	const servers = [
		"189.78.159.213:27015",
		"45.168.140.66:27015",
		"36.73.133.46:27015",
		"124.13.87.222:27015",
		"136.158.11.44:27015",
		"223.27.221.134:27015",
		"113.94.101.121:27015",
		"113.69.128.75:27015",
		"117.189.165.221:27015",
		"202.60.135.29:27015",
		"143.58.222.252:27015",
		"91.121.96.47:27018",
		"83.76.199.115:27015",
		"93.181.62.9:27015",
		"92.246.24.107:27015",
		"77.48.233.149:27015",
		"95.105.193.241:27015",
		"78.99.210.12:27015",
		"78.102.34.230:27015",
		"89.66.237.1:27015",
		"37.190.178.231:27015",
		"46.205.213.113:27015",
		"78.60.159.7:27015",
		"87.95.64.110:27015",
		"164.5.252.72:27015",
		"89.20.7.236:27015",
		"176.108.191.3:27015",
		"178.34.161.249:27015",
		"81.25.76.129:27015",
		"87.117.62.145:27015",
		"89.23.145.28:27015",
		"178.178.85.39:27015",
		"213.242.57.217:27015",
		"46.147.146.90:27015",
		"37.79.140.111:27015",
		"212.74.201.178:27015",
		"5.129.63.130:25565",
		"109.163.216.216:27015",
		"37.49.173.59:27015",
		"60.111.101.217:27015",
		"106.178.178.38:27056"
	  ];

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
