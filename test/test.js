/* eslint-disable no-unused-vars */
/* eslint-disable no-unreachable */
const { Server, MasterServer } = require('../');

MasterServer()
	.then(async servers => {
		console.log(servers);
		console.log('\n'.repeat(5));
		
		while(true){ // eslint-disable-line no-constant-condition
			let [ip, port] = servers[
				Math.floor(Math.random() * servers.length)
			].split(':');

			console.log(ip+':'+port);

			let sv = new Server({ ip, port });

			sv.on('ready', () => {
				console.log('ready');
			});

			await sv.getInfo()
				.then(console.log)
				.catch(console.error);

			await new Promise(res => setTimeout(res, 3000));
			console.log('\n'.repeat(5));

			await sv.getPlayers()
				.then(console.log)
				.catch(console.error);

			await new Promise(res => setTimeout(res, 3000));
			console.log('\n'.repeat(5));

			await sv.getRules()
				.then(console.log)
				.catch(console.error);

			await new Promise(res => setTimeout(res, 3000));
			console.log('\n'.repeat(5));
		}
	})
	.catch(console.error);