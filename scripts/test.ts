/* eslint-disable */
import { debug, Server, MasterServer } from '../src';
// @ts-expect-error asdasd
import * as log from 'why-is-node-running';

debug.enable(__dirname + '/debug.log');

(async () => {
	const servers = await MasterServer({
		timeout: 5000,
		quantity: 30000,
		region: 'ANY',
		slow: false,
		filter: new MasterServer.Filter()
			// .appIds(215, 240, 17550, 17700, 10, 20, 30, 40, 50, 60, 70, 80, 130, 225840) // some of these have bzip2
			// .appIds(10, 20, 30, 40, 50, 60, 70, 80, 130, 225840) // generally goldSource
			.appIds(2400, 2401, 2402, 2403, 2405, 2406, 2410, 2412, 2413, 2420, 2430, 383790) // the ship
	});

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

	for(const err in errors) debug(errors[err]!, err);

	debug(results, 'results')
})().catch(e => console.error('asdasd', e));

// 87.106.170.160:27015
// 81.28.6.20:27015
// 135.125.188.144:27025
