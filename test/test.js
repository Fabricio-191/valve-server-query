/* eslint-disable no-unused-vars */
const { Server, MasterServer, RCON } = require('../');
const debug = true;

async function test(address){
	console.log(address);
	const [ip, port] = address.split(':');

	const server = await Server({
		ip, port,
		options: {
			timeout: 3000,
			debug,
		},
	});

	const data = [
		await server.getInfo(),
		await server.getPlayers(),
		await server.getRules().catch(e => { /* nothing */ }),
	];

	server.disconnect();

	return data;
}

async function testRCON(address, password){
	const [ip, port] = address.split(':');

	const rcon = await RCON({
		ip, port,
		password,
		options: {
			timeout: 5000,
			debug,
		},
	});

	setInterval(() => {
		const value = Math.floor(Math.random() * 10000) - 3000;

		rcon.exec(`sv_gravity ${value}`)
			.then(console.log)
			.catch(console.error);
	}, 5000);
}

MasterServer({ debug, region: 'SOUTH_AMERICA' })
	.then(ips => {
		const ip = ips[Math.floor(Math.random() * ips.length)];

		test(ip)
			.then(console.log)
			.catch(console.error);
	})
	.catch(console.error);
/*
testRCON('213.239.207.78:33045', 'test')
	.catch(console.error);

MasterServer({ debug, region: 'SOUTH_AMERICA' })
	.then(ips => {
		const ip = ips[Math.floor(Math.random() * ips.length)];

		test(ip)
			.then(console.log)
			.catch(console.error);
	})
	.catch(console.error);
*/