/* eslint-disable */
import { log, Server, MasterServerRequest } from '../src';
// @ts-expect-error asdasd
import * as whyIsNodeRunning from 'why-is-node-running';

log.enable(__dirname + '/debug.log');

/*
(async () => {
	const masterServerRequest = new MasterServerRequest({
		timeout: 5000,
		quantity: 15000,
		region: 'SOUTH_AMERICA',
		mode: 'bulk',
		filter: new MasterServerRequest.Filter()
			.appIds(215, 240, 17550, 17700, 10, 20, 30, 40, 50, 60, 70, 80, 130, 225840) // some of these have bzip2
			// .appIds(10, 20, 30, 40, 50, 60, 70, 80, 130, 225840) // generally goldSource
			// .appIds(2400, 2401, 2402, 2403, 2405, 2406, 2410, 2412, 2413, 2420, 2430, 383790) // the ship
	});
	const servers = await masterServerRequest.end();

	console.log(servers.length);
	const results = await Server.bulkQuery(servers, { getPlayers: true });

	console.log('total successful', results.filter(i => !('error' in i.info)).length);
	console.log('total rejected', results.filter(i => 'error' in i.info).length);

	const errors: Record<string, string[]> = {};

	for(const result of results){
		if(!('error' in result.info)) continue;

		const err = result.info.error;
		if(err in errors){
			errors[err]!.push(result.address);
		}else{
			console.log(err);
			errors[err] = [result.address];
		}
	}

	for(const err in errors) log(errors[err]!, err);

	log(results, 'results')
})().catch(e => console.error('asdasd', e));

*/

(async () => {
	const server = new Server({
		ip: 'cs2.1tap.ro',
		port: 27015,
	});
	
	const info = await server.getInfo();
	console.log(info);

	const players = await server.getPlayers();
	console.log(players);


})().catch(e => console.error(e));

// 87.106.170.160:27015
// 81.28.6.20:27015
// 135.125.188.144:27025
