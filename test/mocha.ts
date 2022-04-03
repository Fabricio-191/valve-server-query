/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-invalid-this */
/* eslint-env mocha */
import { Server, RCON, MasterServer } from '../src';
import type { EventEmitter } from 'events';
import { existsSync, writeFileSync } from 'fs';

// https://www.freegamehosting.eu/stats#garrysmod
const regex = /connect (\S+):(\d+) ; rcon_password (\S+)/;

const options = (() => {
	const [ip, port, password] = (regex.exec(
		'connect 49.12.122.244:33027 ; rcon_password cosas'.trim()
	) as RegExpExecArray)
		.slice(1) as [string, string, string];

	return {
		ip,
		port: parseInt(port),
		password,

		enableWarns: false,
		debug: true,
	};
})();

const result: {
	MasterServer: string[] | null;
	server: Record<string, unknown>;
	RCON: Record<string, unknown>;
} = {
	MasterServer: null,
	server: {},
	RCON: {},
};

function MyError(message: string, stack = ''): Error {
	const err = new Error(message);
	err.stack = stack;

	return err;
}

describe('Server', () => {
	it('static getInfo()', async function(){
		this.retries(3);

		const info = await Server.getInfo(options);

		checkInfo(info);
		result.server['static getInfo()'] = info;
	});

	let server;
	it('connect', async function(){
		this.retries(3);
		this.slow(9000);
		this.timeout(10000);

		server = await Server(options);
	});

	it('getInfo()', async () => {
		if(!server) throw MyError('Server not connected');

		const info = await server.getInfo();

		checkInfo(info);
		result.server.getInfo = info;
	});

	it('getPlayers()', async () => {
		if(!server) throw MyError('Server not connected');

		result.server.getPlayers = await server.getPlayers();
	});

	it('getRules()', async () => {
		if(!server) throw MyError('Server not connected');

		result.server.getRules = await server.getRules();
	});

	it('getPing()', async () => {
		if(!server) throw MyError('Server not connected');

		result.server.getPing = await server.getPing();
	});

	it('lastPing', () => {
		if(!server) throw MyError('Server not connected');

		if(typeof server.lastPing !== 'number' || isNaN(server.lastPing)){
			throw MyError('Server.lastPing is not a number');
		}else if(server.lastPing < -1){
			throw MyError(`Server.lastPing is too small (${server.lastPing})`);
		}

		result.server.lastPing = server.lastPing;
	});
});


const ipv4RegexWithPort = /(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}/;
// const ipv4Regex = /(?:\d{1,3}\.){3}\d{1,3}/;
describe('MasterServer', () => {
	it('query', async () => {
		const ips = await MasterServer({
			region: 'SOUTH_AMERICA',
			quantity: 900,
			timeout: 5000,
			debug: false,
		});

		if(!Array.isArray(ips)){
			throw new Error('ips is not an array');
		}else if(ips.length === 0){
			throw new Error('ips is empty');
		}else if(ips.some(x => typeof x !== 'string')){
			throw new Error('ips contains non-string values');
		}else if(ips.some(str => !ipv4RegexWithPort.test(str))){
			throw new Error('ips contains invalid IPs');
		}else if(Math.abs(ips.length - 900) > 100){
			throw new Error('ips does not have ~900 servers');
		}

		result.MasterServer = ips;
	});

	it('filter', async function(){
		this.slow(14000);
		this.timeout(15000);
		const filter = new MasterServer.Filter()
			.add('map', 'de_dust2')
			.addFlag('linux')
			.addNOR(
				new MasterServer.Filter()
					.addFlag('secure')
			);

		const IPs = await MasterServer({
			// debug: true,
			filter,
			quantity: 300,
		});

		let results = await Promise.allSettled(
			IPs.map(address => {
				// eslint-disable-next-line no-shadow
				const [ip, port] = address.split(':') as [string, string];

				return Server.getInfo({
					ip,
					port: parseInt(port),
				});
			})
		);

		results = results
			.filter(x => x.status === 'fulfilled')
			.map(x => x.value);

		if(!results.every(x =>
			x.OS === 'linux' &&
			x.map === 'de_dust2' &&
			!x.VAC
		)){
			throw new Error('Filter is not working well');
		}
	});
});

describe('RCON', () => {
	// eslint-disable-next-line @typescript-eslint/init-declarations
	let rcon: InstanceType<typeof RCON>;
	it('connect and authenticate', async function(){
		this.retries(3);

		rcon = await RCON(options);
	});

	it("exec('sv_gravity') (single packet response)", async () => {
		if(!rcon) throw MyError('RCON not connected');

		result.RCON["exec('sv_gravity')"] = await rcon.exec('sv_gravity');
	});

	it("exec('cvarlist') (multiple packet response)", async function(){
		this.slow(9000);
		this.timeout(10000);
		if(!rcon) throw MyError('RCON not connected');

		result.RCON["exec('cvarlist')"] = await rcon.exec('cvarlist');
	});

	it("exec('status')", async () => {
		if(!rcon) throw MyError('RCON not connected');

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
		if(!rcon) throw MyError('RCON not connected');

		rcon.exec('sv_gravity 0').catch(() => {});

		await shouldFireEvent(rcon, 'disconnect', 3000);
		await rcon.reconnect();

		rcon.exec('sv_gravity 0').catch(() => {});

		await shouldFireEvent(rcon, 'disconnect', 3000);
		await rcon.reconnect();
	});

	it('should manage password changes', async () => {
		if(!rcon || !rcon.connection._ready) throw MyError('RCON not connected');

		rcon.exec('rcon_password cosas2').catch(() => {});
		await shouldFireEvent(rcon, 'disconnect', 3000);

		await Promise.all([
			rcon.reconnect(),
			shouldFireEvent(rcon, 'passwordChange', 3000),
		]);

		await rcon.authenticate('cosas2');


		rcon.exec('rcon_password cosas').catch(() => {});
		await shouldFireEvent(rcon, 'disconnect', 3000);

		await Promise.all([
			rcon.reconnect(),
			shouldFireEvent(rcon, 'passwordChange', 3000),
		]);

		await rcon.authenticate('cosas');
	});
});

after(() => {
	const path = existsSync('./test') ?
		'./test/result.json' : './result.json';

	writeFileSync(
		path,
		JSON.stringify(
			result,
			(_key, value: unknown) => {
				if(typeof value === 'bigint') return value.toString() + 'n';
				return value;
			},
			'\t'
		)
	);
});

let id = 1;
/* eslint-disable @typescript-eslint/no-use-before-define */
function shouldFireEvent(obj: EventEmitter, event: string, time: number): Promise<void> {
	const err = new Error(`Event ${event} (${id++}) not fired`);

	return new Promise((res, rej) => {
		const clear = (): void => {
			obj.off(event, onEvent);
			clearTimeout(timeout);
		};;
		const onEvent = (): void => {
			clear(); res();
		};

		const timeout = setTimeout(() => {
			clear();
			rej(err);
		}, time).unref();
		obj.on(event, onEvent);
	});
}
/* eslint-enable @typescript-eslint/no-use-before-define */

function checkInfo(info: object): void {
	for(const key of ['appID', 'OS', 'protocol', 'version', 'map']){
		if(!(key in info)){
			throw new Error('Missing keys in data');
		}
	}
}