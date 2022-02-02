// @ts-nocheck
// eslint-disable-next-line no-unused-vars
const { Server, MasterServer, RCON } = require('../');

/*
const [ip, port, password] =
	'connect 49.12.122.244:33041 ; rcon_password cosas'
		.match(/connect (\S+):(\S+) ; rcon_password (\S+)/)
		.slice(1);

const options = {
	ip,
	port: parseInt(port),
	password,
	timeout: 10000,

	enableWarns: false,
	debug: true,
};
*/

(async function(){
	const ips = await MasterServer({
		// debug: true,
		filter: {
			nor: {
				flags:  ['secure'],
			},
			flags: ['linux'],
			map: 'de_dust2',
		},
		quantity: 300,
	});

	let results = await Promise.allSettled(
		ips.map(address => {
			const [ip, port] = address.split(':');

			return Server.getInfo({
				ip,
				port: parseInt(port),
			});
		}),
	);

	results = results
		.filter(x => x.status === 'fulfilled')
		.map(x => x.value);

	console.log(ips.length, results.length);
	console.log(
		results.every(x =>
			x.OS === 'linux' &&
			x.map === 'de_dust2' &&
			!x.VAC,
		),
	);
})()
	.catch(e => console.log('handled', e));