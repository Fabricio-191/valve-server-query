/* eslint-disable no-empty-function */
/* eslint-disable no-unused-vars */
// @ts-ignore
const dns = require('dns');
// @ts-ignore
const { Server, MasterServer, RCON } = require('../');
const debug = true, timeout = 10000;

async function test(address){
	console.log(address);
	const [ip, port] = address.split(':');

	const server = await Server({
		ip, port,
		options: {
			timeout,
			debug,
		},
	});

	const data = [
		await server.getInfo(),
		await server.getPlayers().catch(() => {}),
		await server.getRules().catch(() => {}),
	];

	server.disconnect();

	return data;
}

testRCON('connect 213.239.207.78:33005 ; rcon_password cosas');
async function testRCON(str){
	const [, ip, port, password] = str
		.match(/connect (\S+):(\d+) ; rcon_password (\S+)/);

	const rcon = await RCON({
		ip, port,
		password,
		options: {
			enableWarns: false,
			timeout: 5000,
			debug,
		},
	});

	rcon.on('disconnect', async (reason, reconnect) => {
		console.log(reason);
		try{
			await reconnect();
		}catch(e){
		}
	});

	rcon.on('passwordChange', async handleAuth => {
		try{
			await handleAuth('cosas2');
		}catch(e){
			console.error('Failed to authenticate with new password', e.message);
		}
	});

	console.log(await rcon.exec('sv_gravity'))
	await rcon.exec('sv_gravity 0').catch(e => {});

	// eslint-disable-next-line no-promise-executor-return
	await new Promise(res => setTimeout(res, 1000));

	rcon.exec('sv_gravity')
		.then(console.log)
		.catch(console.error);

	console.log('end of program');
}
/*

MasterServer({ debug: false, region: 'SOUTH_AMERICA', timeout })
	.then(ips => {
		const ip = ips[Math.floor(Math.random() * ips.length)];

		test(ip)
			.then(console.log)
			.catch(console.error);
	})
	.catch(console.error);
*/


function ping(ip){
	return new Promise((resolve, reject) => {
		require('child_process').exec(
			`ping ${ip}`,
			{ windowsHide: true },
			(err, stdout, stderr) => {
				if(err || stderr) return reject(err || stderr);

				resolve(stdout);
			});
	});
}

async function testOther(address){
	const [ip, port] = address.split(':');

	try{
		const sv = await Server({
			ip, port,
			options: {
				timeout: 5000,
				debug: false,
			},
		});

		try{
			const data = await sv.getInfo();
			console.log('Is a server', data);
		}catch(e){
			console.log('Is a server');
		}
	}catch(e){
		console.log(e.message);
	}

	try{
		await MasterServer({
			ip, port,
			timeout: 5000,
			debug: false,
		});

		console.log('Is a master server');
	}catch(e){
		console.log(e.message);
	}

	try{
		const ips = await new Promise((res, rej) => {
			dns.resolveAny(ip, (err, result) => {
				if(err) return rej(err);
				res(result);
			});
		});

		console.log('dns', ips);
	}catch(e){
		console.log(e.message);
	}

	try{
		await ping(ip);

		console.log('Server is alive');
	}catch(e){
		console.log(e.message);
		console.log('Server is dead');
	}
}
