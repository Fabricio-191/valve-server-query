import { appendFileSync } from 'fs';
import type { BaseData } from './options';

let logStr = '';
let isEnabled = false;
let debugFile = 'debug.log';

const logger = {
	get isEnabled(): boolean {
		return isEnabled;
	},
	enable(file = 'debug.log'): void {
		if(isEnabled) throw new Error('Debug already enabled');
		isEnabled = true;
		debugFile = file;
	
	
		// logStr += `Log start at ${(new Date()).toLocaleTimeString()}\n\n`
		setInterval(this.save, 1000).unref();
	
		const handleExit = (err?: unknown): void => {
			this.save();
	
			// eslint-disable-next-line no-console
			if(err) console.error('unhandled', err);
	
			setTimeout(() => {
				// logStr += `Log end at ${(new Date()).toLocaleTimeString()}\n\n`
				this.save();
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
	},
	save(file = debugFile): void {
		if(logStr === '') return;
		appendFileSync(file, logStr);
		logStr = '';
	},
	message(data: BaseData, text: string): void {
		const type =
			// eslint-disable-next-line no-nested-ternary
			'password' in data ? 'RCON' : 'region' in data ? 'MasterServer' : 'Server';
		
		logStr += `[${type}] ${data.ip}:${data.port} - ${text}\n\n`;
	},
	object(text: string, object: object): void {
		const data = JSON.stringify(object, (_, v: unknown) => {
			if(typeof v === 'bigint') return v.toString() + 'n';
			return v;
		}, 2);

		logStr += `[${text}] - ${data}\n\n`;
	},
	buffer(data: BaseData, text: string, buffer: Buffer): void {
		const parts = buffer.toString('hex').match(/../g) ?? [ '<empty>' ];
		this.message(data, `${text} ${parts.join(' ')}`);
	}
}

export default logger;