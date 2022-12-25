/*
Example of how to make multiple queries to multiple servers, all at the same time
*/
const { MasterServer, Server } = require('@fabricio-191/valve-server-query');

async function getServerData(address){
	const [ip, port] = address.split(':');

	const server = await Server({
		ip,
		port: parseInt(port),
		timeout: 4000,
	});

	const [info, players, rules] = await Promise.all([
		server.getInfo(),
		// get players and get rules are optional
		server.getPlayers().catch(() => []),
		server.getRules().catch(() => ({})),
	]);

	return { info, players, rules };
}

(async () => {
	const servers = await MasterServer({ // servers is an array if 'ip:port' strings
		quantity: 3000, // at least 3000
		region: 'US_EAST',
		timeout: 3000,
	});

	console.log('Servers found:', servers.length);

	const start = Date.now();

	// allSeattled because some of the queries will fail
	const results = await Promise.allSettled(servers.map(getServerData));
	const succesful = results
		.filter(result => result.status === 'fulfilled')
		.map(result => result.value);

	const errors = results
		.filter(result => result.status === 'rejected')
		.reduce((acc, result) => {
			acc[result.reason] = (acc[result.reason] || 0) + 1;
			return acc;
		}, {});

	console.log(errors);

	console.log('Servers with succesful queries:', succesful.length);
	console.log('Time elapsed:', Date.now() - start, 'ms');
})()
	.catch(console.error);