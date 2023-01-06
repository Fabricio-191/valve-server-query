/* eslint-disable */

// @ts-ignore
import valve from '../src';
// @ts-expect-error why-is-node-running has no typings
import * as log from 'why-is-node-running';

valve.debug.enable('./test/debug.log');
valve.setDefaultOptions({
	timeout: 10000,
});

const server = new valve.Server();

server.connect('85.190.154.179:27017')
	.then(console.log)
	.catch(console.error);

/*
To-do:
* Server better connected promises
* Server ping command
* ServerWatch statusUpdate event

To-upgrade:
* Master Server rate limit
* Master Server web api
* Server BZIP
*/

/*
const onChunk = (servers: string[]): void => {
	console.log(servers.length)
}

MasterServer({
	ip: '208.64.200.65',
	port: 27011,
	timeout: 5000,
	quantity: 60000,
}, onChunk)
	.catch(console.error)

*/

/*
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
	const servers = [
		'149.28.44.79:27017',
		'162.248.93.98:27015',
		'74.91.124.33:27015',
		'208.77.22.138:9000',
		'208.77.22.138:9002',
		'206.217.202.50:27015',
		'74.91.113.158:27015',
		'149.28.44.79:27017',
		'208.77.22.138:9002',
		'51.79.39.133:40002',
		'51.79.39.133:40003',
		'65.108.205.169:27015',
		'85.215.228.127:27010',
		'65.108.205.169:27015',
	] || await MasterServer({
		timeout: 5000,
		quantity: 3000,
		filter: new MasterServer.Filter()
			// .is('proxy')
			.appIds(215, 240, 17550, 17700)
			// .appIds(10, 20, 30, 40, 50, 60, 70, 80, 130, 225840),
	});

	debug(servers, 'servers');

	console.log(servers.length);
	const infos = await Promise.allSettled(servers.map(Server.getRules));

	console.log(infos.filter(i => i.status === 'fulfilled').length);
	console.log(infos.filter(i => i.status === 'rejected').length);

	classifyErrors(infos, servers);

	// @ts-expect-error asd
	const d = infos.filter(i => i.status === 'fulfilled').map(i => i.value) as AnyServerInfo[];

	debug(d, 'infos');
	debug(d.filter(x => x.protocol === 7), 'infos-7');
}); // ().catch(console.error);

*/