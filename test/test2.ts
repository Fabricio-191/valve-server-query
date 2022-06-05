/* eslint-disable */
import { Server, MasterServer } from '../src';

(async function(){
	let address = 'us1.npcs.gg:27015';
	// eslint-disable-next-line new-cap
	const addresses = await MasterServer({
		debug: true,
		quantity: 1,
	}) as [string];
	address = addresses[
		Math.floor(Math.random() * addresses.length)
	] as string;

	console.log(address);

	const [ip, port] = address.split(':') as [string, string];

	const info = await Server.getInfo({
		ip, port: parseInt(port, 10),
		debug: true,
	});

	console.log(info);
})()
	.catch(console.log);