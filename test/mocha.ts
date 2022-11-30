/* eslint-disable @typescript-eslint/no-invalid-this */
/* eslint-env mocha */
import { Server, RCON, MasterServer, FinalServerInfo } from '../src';
import type { EventEmitter } from 'events';
import { writeFileSync } from 'fs';

// https://www.freegamehosting.eu/stats#garrysmod
const options = {
	ip: '213.239.207.78:33035',
	password: 'cosas',

	enableWarns: false,
	debug: false,
};

const result = {
	MasterServer: [] as string[],
	server: {
		lastPing: 0,
		getInfo: {},
		getPlayers: {},
		getRules: {},
		getPing: {},
	},
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	RCON: {} as Record<string, unknown>,
};

class MyError extends Error {
	constructor(message: string, stack = '') {
		super(message);
		this.stack = stack;
	}
}

function checkInfo(info: object): void {
	for(const key of ['appID', 'OS', 'protocol', 'version', 'map']){
		if(!(key in info)){
			throw new MyError('Missing keys in data');
		}
	}
}

/*
const byteRegex = '(?:(?:[1-9]?\\d)|(?:1\\d\\d)|(?:2[0-4]\\d)|(?:25[0-5]))'; // 0 - 255
const portRegex = '((?:[0-5]?\\d{1,4})|(?:6[0-4]\\d{3})|(?:65[0-4]\\d{2})|(?:655[0-2]\\d)|(?:6553[0-5]))'; // 0 - 65535

const ipv4RegexWithPort = new RegExp(`^((?:${byteRegex}\\.){3}${byteRegex}):${portRegex}$`);
*/

const ipv4RegexWithPort = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/;

function checkIP(ip: unknown): void {
	if(typeof ip !== 'string'){
		throw new MyError('IP is not a string');
	}

	const matches = ipv4RegexWithPort.exec(ip);

	if(!matches){
		throw new MyError('IP is not valid');
	}

	for(let i = 1; i < 5; i++){
		const num = Number(matches[i]);
		if(num < 0 || num > 255){
			throw new MyError('Field in IP is not valid');
		}
	}

	const port = Number(matches[5]);
	if(port < 0 || port > 65535){
		throw new MyError('Port in IP is not valid');
	}
}

describe('MasterServer', () => {
	it('query', async () => {
		// eslint-disable-next-line new-cap
		const IPs = await MasterServer({
			region: 'SOUTH_AMERICA',
			quantity: 900,
			timeout: 5000,
			debug: options.debug,
		});

		if(!Array.isArray(IPs)){
			throw new Error('ips is not an array');
		}else if(Math.abs(IPs.length - 900) > 100){ // 900 ± 100
			throw new Error('ips does not have ~900 servers');
		}

		IPs.forEach(checkIP);

		result.MasterServer = IPs;
	});

	it('filter', async function(){
		this.slow(14000);
		this.timeout(15000);

		const filter = new MasterServer.Filter()
			.add('appid', 730)
			.addFlag('linux')
			.addFlag('dedicated')
			.addFlag('password')
			.addNOR(
				new MasterServer.Filter()
					.addFlag('secure')
			);

		// eslint-disable-next-line new-cap
		const IPs = await MasterServer({
			// debug: true,
			filter,
			region: 'SOUTH_AMERICA',
			quantity: 1000,
		});

		const results = await Promise.allSettled(IPs.map(address => {
			// eslint-disable-next-line @typescript-eslint/no-shadow
			const [ip, port] = address.split(':') as [string, string];

			return Server.getInfo({
				ip,
				port: parseInt(port),
			});
		}))

		const satisfiesFilter = results
			.filter(x => x.status === 'fulfilled')
			// @ts-expect-error 
			.map(x => x.value)
			.filter((x: FinalServerInfo) =>
				x.appID === 730 &&
				x.OS === 'linux' &&
				x.type === 'dedicated' &&
				x.hasPassword &&
				!x.VAC
			)
			.length;

		if(results.length - satisfiesFilter < results.length * 0.1){ // (10% error margin) master servers are not perfect
			throw new Error('Filter is not working well');
		}
	});
});

describe('Server ', () => {
	it('static getInfo()', async () => {
		const info = await Server.getInfo(options);

		checkInfo(info);
	});

	const server = new Server();
	it('connect', async function(){
		this.slow(9000);
		this.timeout(10000);

		await server.connect(options);
	});

	it('getInfo()', async () => {
		if(!server) throw new MyError('Server not connected');

		const info = await server.getInfo();

		checkInfo(info);
		result.server.getInfo = info;
	});

	it('getPlayers()', async () => {
		if(!server) throw new MyError('Server not connected');

		result.server.getPlayers = await server.getPlayers();
	});

	it('getRules()', async () => {
		if(!server) throw new MyError('Server not connected');

		result.server.getRules = await server.getRules();
	});

	it('getPing()', async () => {
		if(!server) throw new MyError('Server not connected');

		result.server.getPing = await server.getPing();
	});

	it('lastPing', () => {
		if(!server) throw new MyError('Server not connected');

		if(typeof server.lastPing !== 'number' || isNaN(server.lastPing)){
			throw new MyError('Server.lastPing is not a number');
		}else if(server.lastPing <= -1){
			throw new MyError(`Server.lastPing is too small (${server.lastPing})`);
		}

		result.server.lastPing = server.lastPing;
	});

	it('should work in random servers', async function(){
		this.slow(20000);
		this.timeout(30000);

		for(const address of result.MasterServer){
			const [ip, port] = address.split(':') as [string, string];

			const server = new Server();

			await server.connect({
				ip,
				port: parseInt(port),
				timeout: 10000,
			});

			const info = await server.getInfo();
			checkInfo(info);
		}
	});
});

describe('RCON', () => {
	const rcon = new RCON();
	it('connect and authenticate', async () => {
		await rcon.connect(options);
	});

	it("exec('sv_gravity') (single packet response)", async () => {
		result.RCON["exec('sv_gravity')"] = await rcon.exec('sv_gravity');
	});

	it("exec('cvarlist') (multiple packet response)", async function(){
		this.slow(9000);
		this.timeout(10000);
		result.RCON["exec('cvarlist')"] = await rcon.exec('cvarlist');
	});

	it("exec('status')", async () => {
		result.RCON["exec('status')"] = await rcon.exec('status');
	});

	it('multiple requests', async function(){
		this.slow(9000);
		this.timeout(10000);

		await Promise.all([
			rcon.exec('cvarlist'),
			rcon.exec('status'),
			rcon.exec('sv_gravity'),
		]);

		await Promise.all([
			rcon.exec('sv_gravity'),
			rcon.exec('status'),
			rcon.exec('cvarlist'),
		]);
	});

	it('should reconnect', async () => {
		rcon.exec('sv_gravity 0').catch(() => { /* do nothing */ });

		await shouldFireEvent(rcon, 'disconnect', 3000);
		await rcon.reconnect();

		rcon.exec('sv_gravity 0').catch(() => { /* do nothing */ });

		await shouldFireEvent(rcon, 'disconnect', 3000);
		await rcon.reconnect();
	});

	it('should manage password changes', async () => {
		rcon.exec('rcon_password cosas2').catch(() => { /* do nothing */ });
		await shouldFireEvent(rcon, 'disconnect', 3000);

		await Promise.all([
			rcon.reconnect(),
			shouldFireEvent(rcon, 'passwordChange', 3000),
		]);

		await rcon.authenticate('cosas2');


		rcon.exec('rcon_password cosas').catch(() => { /* do nothing */ });
		await shouldFireEvent(rcon, 'disconnect', 3000);

		await Promise.all([
			rcon.reconnect(),
			shouldFireEvent(rcon, 'passwordChange', 3000),
		]);

		await rcon.authenticate('cosas');
	});
});

describe('options', () => {
	
})

after(() => {
	writeFileSync(
		'./test/result.json',
		JSON.stringify(
			result,
			(_, v: unknown) => {
				if(typeof v === 'bigint') return v.toString() + 'n';
				return v;
			},
			'\t'
		)
	);
});

let id = 1;
function shouldFireEvent(obj: EventEmitter, event: string, time: number): Promise<void> {
	const err = new Error(`Event ${event} (${id++}) not fired`);

	return new Promise((res, rej) => {
		const end = (error: unknown): void => {
			obj.off(event, end);
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			clearTimeout(timeout);

			if(error) rej(err);
			else res();
		};

		const timeout = setTimeout(end, time, err).unref();

		obj.on(event, end);
	});
}
