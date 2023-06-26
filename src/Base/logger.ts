import { appendFileSync } from 'fs';
import type { BaseData } from './options';

export let isEnabled = false;
let logStr = '';
let debugFile = 'debug.log';

export function log(data: BaseData | number | object | string, string: string, buffer?: Buffer): void {
	if(!isEnabled) return;

	if(typeof data === 'object' && 'ip' in data){
		const type =
			// eslint-disable-next-line no-nested-ternary
			'password' in data ? 'RCON' : 'region' in data ? 'MasterServer' : 'Server';

		logStr += `[${type}] ${data.ip}:${data.port} - ${string} `;

		if(buffer){
			const parts = buffer.toString('hex').match(/../g) ?? [ '<empty>' ];

			logStr += parts.join(' ');
		}
	}else{
		data = JSON.stringify(data, (_, v: unknown) => {
			if(typeof v === 'bigint') return v.toString() + 'n';
			return v;
		}, 2);

		logStr += `[${string}] - ${data}`;
	}

	logStr += '\n\n';
}

log.enable = function(file = 'debug.log'): void {
	if(isEnabled) throw new Error('Debug already enabled');
	isEnabled = true;
	debugFile = file;


	setInterval(log.save, 1000).unref();

	const handleExit = (err?: unknown): void => {
		log.save();

		// eslint-disable-next-line no-console
		if(err) console.error('unhandled', err);

		setTimeout(() => {
			log.save();
			// eslint-disable-next-line no-console
			console.log('debugging end');
			process.exit();
		}, 5000);
	};

	process.on('beforeExit', handleExit);
	process.on('SIGINT', handleExit);
	process.on('SIGUSR1', handleExit);
	process.on('SIGUSR2', handleExit);
	process.on('uncaughtException', handleExit);
};

log.save = function(file = debugFile): void {
	if(logStr === '') return;
	appendFileSync(file, logStr);
	logStr = '';
};
