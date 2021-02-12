/* eslint-disable no-unused-vars */
// @ts-check
const { Server, MasterServer } = require('../').setSocketRef(false);

MasterServer()
	.then(async servers => {
		console.log(servers.length);
		while(servers[0]){
			await test(servers.shift())
				.catch(console.error);

			await delay(5000);
			console.log('\n');
		}
	})
	.catch(console.trace);

function delay(time = 1000){
	return new Promise(res => {
		setTimeout(res, time);
	});
}

async function test(address){
	console.log(address);
	const [ip, port] = address.split(':');

	const server = await Server({
		ip, port,
		timeout: 2000,
	});

	const data = await Promise.all([
		server.getInfo(),
		server.getPlayers(),
		server.getRules()
	]);

	server.disconnect();

	return data;
}