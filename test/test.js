/* eslint-disable no-unused-vars */
// @ts-check
const { Server, MasterServer } = require('../');
const debug = false;

MasterServer({ debug })
	.then(async servers => {
		console.log(servers.length);
		console.log('\n');
		while(servers[0]){
			await test(servers.shift())
				.catch(console.error);

			console.log('\n');
		}
	})
	.catch(console.trace);


async function test(address){
	console.log(address);
	const [ip, port] = address.split(':');

	const server = await Server({
		ip, port,
		timeout: 2000,
		debug,
	});

	const data = await Promise.all([
		server.getInfo(),
		server.getPlayers(),
		server.getRules()
	]);

	server.disconnect();

	return data;
}