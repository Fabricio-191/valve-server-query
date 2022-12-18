/* eslint-disable new-cap */
/* eslint-disable no-console */

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
import { MasterServer } from '../src';
const filter = new MasterServer.Filter()
	.appId(240);
const regions = ['US_EAST', 'US_WEST', 'SOUTH_AMERICA', 'EUROPE', 'ASIA', 'AUSTRALIA', 'MIDDLE_EAST', 'AFRICA'] as const;

(async () => {
	const results = {
		ALL: [] as string[],
		OTHER: [] as string[],
	};

	for(const region of regions){
		console.log(region);
		results.ALL.push(
			...await MasterServer({
				filter,
				quantity: 'all',
				region,
			})
		);
		await delay(5000);
	}

	results.OTHER = await MasterServer({
		filter,
		quantity: 'all',
		region: 'ANY',
	});

	const shared = results.ALL.filter(ip => results.OTHER.includes(ip));

	console.log(shared);
	console.log(shared.length);
	console.log(results.ALL.length);
	console.log(results.OTHER.length);
})()
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