import { writeFileSync } from 'fs';
import type { BaseData } from './options';

export let isEnabled = false;
let log = '';
let debugFile = 'debug.log';

export function debug(data: BaseData | number | object | string, string: string, buffer?: Buffer): void {
	if(!isEnabled) return;

	if(typeof data === 'object' && 'address' in data){
		const type =
			// eslint-disable-next-line no-nested-ternary
			'multiPacketGoldSource' in data ? 'Server' : 'region' in data ? 'MasterServer' : 'RCON';

		log += `[${type}] ${data.address} - ${string} `;

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
	process.on('beforeExit', debug.save);
};

debug.save = function(file = debugFile): void {
	if(log !== '') writeFileSync(file, log);
};
