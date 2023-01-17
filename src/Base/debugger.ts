import { writeFileSync } from 'fs';
import type { BaseData } from './options';

export let isEnabled = false;
let log = '';
let debugFile = 'debug.log';

export function debug(data: BaseData | number | object | string, string: string, buffer?: Buffer): void {
	if(!isEnabled) return;

	if(typeof data === 'object' && 'ip' in data){
		const type =
			// eslint-disable-next-line no-nested-ternary
			'multiPacketGoldSource' in data ? 'Server' : 'region' in data ? 'MasterServer' : 'RCON';

		log += `[${type}] ${data.ip}:${data.port} - ${string} `;

		if(buffer){
			const parts = buffer.toString('hex').match(/../g) ?? [ '<empty>' ];

			log += parts.join(' ');
		}
	}else{
		data = JSON.stringify(data, (_, v: unknown) => {
			if(typeof v === 'bigint') return v.toString() + 'n';
			return v;
		}, 2);

		log += `[${string}] - ${data}`;
	}

	log += '\n\n';
}

debug.enable = function(file = 'debug.log'): void {
	if(isEnabled) throw new Error('Debug already enabled');
	isEnabled = true;
	debugFile = file;


	setInterval(debug.save, 1000).unref();

	const handleExit = (): void => {
		debug.save();

		setTimeout(() => {
			debug.save();
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

debug.save = function(file = debugFile): void {
	if(log !== '') writeFileSync(file, log);
};
