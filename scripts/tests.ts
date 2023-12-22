import { describe, it } from 'node:test';
import { isIPv4 } from 'node:net';
import type { EventEmitter } from 'events';

import * as valve from '../src';

valve.log.enable(__dirname + '/tests.log');
const doNothing = (): void => { /* do nothing */ };

// https://www.freegamehosting.eu/stats#garrysmod
const options = {
	ip: '213.239.207.78:33007',
	password: 'cosas',
	enableWarns: false,
};

describe('Server', () => {
	// eslint-disable-next-line @typescript-eslint/init-declarations
	let server: valve.Server;

	it('constructor', () => {
		server = new valve.Server(options);
	});

	it('getInfo()', async () => {
		const info = await server.getInfo();
		valve.log(info, 'Server info');
	});

	it('getPlayers()', { concurrency: true }, async () => {
		const players = await server.getPlayers();
		valve.log(players, 'Server players');
	});

	it('getRules()', { concurrency: true }, async () => {
		const rules = await server.getRules();
		valve.log(rules, 'Server rules');
	});

	it('lastPing', { concurrency: true }, () => {
		if(typeof server.lastPing !== 'number' || isNaN(server.lastPing)){
			throw new Error('server.lastPing is not a number');
		}else if(server.lastPing <= -1){
			throw new Error(`server.lastPing is too small (${server.lastPing})`);
		}

		valve.log(server.lastPing, 'Server ping');
	});

	it('others constructors', { concurrency: true }, async () => {
		const option = [
			// eslint-disable-next-line no-undefined
			undefined,
			{},
			options.ip,
			{ ip: options.ip },
			{ ip: options.ip.split(':')[0]!, port: options.ip.split(':')[1]! },
			{ ip: options.ip.split(':')[0]!, port: Number(options.ip.split(':')[1]) },
		] as const;

		await Promise.all(option.map(opt =>  valve.Server.getInfo(opt)));
	});
});

function checkIPv4WithPort(address: string): void {
	if(typeof address !== 'string') throw new Error('IP is not a string');

	const ip = address.split(':')[0];
	const port = Number(address.split(':')[1]);
	
	if(!(ip && isIPv4(ip) && Number.isInteger(port) && port >= 0 && port <= 65535)) throw new Error('IP is not valid');
}

describe('MasterServer', () => {
	it('query', { concurrency: true }, async function(){
		// this.slow(14000);
		// this.timeout(15000);

		const MasterServerRequest = new valve.MasterServerRequest({
			region: 'SOUTH_AMERICA',
			quantity: 900,
			timeout: 5000,
		});
		const IPs = await MasterServerRequest.end();

		if(!Array.isArray(IPs)){
			throw new Error('ips is not an array');
		}else if(Math.abs(IPs.length - 900) > 100){ // 900 ± 100
			throw new Error('ips does not have ~900 servers');
		}

		IPs.forEach(checkIPv4WithPort);

		valve.log(IPs, 'MasterServer result');
	});

	it('filter', { concurrency: true }, async function(){
		// this.slow(14000);
		// this.timeout(15000);

		const filter = new valve.MasterServerRequest.Filter()
			.appId(730)
			.is('linux', 'dedicated', 'password_protected')
			.is('not_secure');

		const request = new valve.MasterServerRequest({
			filter,
			region: 'SOUTH_AMERICA',
			quantity: 1000,
		});

		const IPs = await request.end();

		const results = await Promise.allSettled(IPs.map(valve.Server.getInfo));

		const satisfiesFilter = results
			.filter(x => x.status === 'fulfilled')
			// @ts-expect-error promise are fullfiled
			.map(x => x.value as valve.AnyServerInfo)
			.filter((x: valve.AnyServerInfo) =>
				('appID' in x ? x.appID : -1) === 730 &&
				x.OS === 'linux' &&
				x.type === 'dedicated' &&
				x.hasPassword &&
				!x.VAC
			)
			.length;

		if(results.length - satisfiesFilter < results.length * 0.1){ // (10% error margin)
			throw new Error('Filter is not working well');
		}
	});
});

describe('RCON', () => {
	const rcon = new valve.RCON();

	rcon.unref();

	it('connect and authenticate', () => rcon.connect(options));

	it("exec('sv_gravity') (single packet response)", { concurrency: true }, async () => {
		const result = await rcon.exec('sv_gravity');
		valve.log(result, "exec('sv_gravity')");
	});

	it("exec('cvarlist') (multiple packet response)", { concurrency: true }, async function(){
		//this.slow(9000);
		//this.timeout(10000);

		const result = await rcon.exec('cvarlist');
		valve.log(result, "exec('cvarlist')");
	});

	it("exec('status')", { concurrency: true }, async () => {
		const result = await rcon.exec('status');
		valve.log(result, "exec('status')");
	});

	it('multiple requests', async function(){
		// this.slow(9000);
		// this.timeout(10000);

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
		rcon.exec('sv_gravity 0').catch(doNothing);
		await shouldFireEvent(rcon, 'disconnect', 3000);
		await rcon.reconnect();

		rcon.exec('sv_gravity 0').catch(doNothing);

		await shouldFireEvent(rcon, 'disconnect', 3000);
		await rcon.reconnect();
	});

	it('should manage password changes', async () => {
		rcon.exec('rcon_password cosas2').catch(doNothing);
		await shouldFireEvent(rcon, 'disconnect', 3000);

		await Promise.all([
			rcon.reconnect(),
			shouldFireEvent(rcon, 'passwordChange', 3000),
		]);

		await rcon.authenticate('cosas2');


		rcon.exec('rcon_password cosas').catch(doNothing);
		await shouldFireEvent(rcon, 'disconnect', 3000);

		await Promise.all([
			rcon.reconnect(),
			shouldFireEvent(rcon, 'passwordChange', 3000),
		]);

		await rcon.authenticate('cosas');
	});
});

let id = 1;
function shouldFireEvent(obj: EventEmitter, event: string, time: number): Promise<void> {
	const err = new Error(`Event ${event} (${id++}) not fired`);

	return new Promise((res, rej) => {
		const end = (error?: unknown): void => {
			obj.off(event, end);
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			clearTimeout(timeout);

			if(error) rej(err);
			else res();
		};

		const timeout = setTimeout(end, time, err).unref();
		obj.on(event, () => end());
	});
}
