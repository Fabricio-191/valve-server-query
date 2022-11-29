import { debug } from '../utils';
import { createSocket } from 'dgram';

import type { MasterServerData } from '../options';

const connections = new Map<string, Connection>();
const socket = createSocket('udp4')
	.on('message', (buffer, rinfo) => {
		const connection = connections.get(`${rinfo.address}:${rinfo.port}`);
		if(!connection) return;
	
		if(connection.data.debug) debug('MASTERSERVER recieved:', buffer);
	
		const header = buffer.readInt32LE();
		if(header !== -1){
			if(header === -2){
				throw new Error('Multi-packet shouldn\'t happen in master servers wtf are u doing ?');
			}else{
				throw new Error('Invalid packet');
			}
		}
	
		socket.emit('packet', buffer.slice(4));
	})
	.unref();

export default class Connection {
	constructor(data: MasterServerData) {
		this.data = data;
	}
	public readonly data: MasterServerData;

	public connect(): void {
		socket.setMaxListeners(socket.getMaxListeners() + 10);
		connections.set(this.data.address, this);
	}

	public destroy(): void {
		socket.setMaxListeners(socket.getMaxListeners() - 10);
		connections.delete(this.data.address);
	}

	public async send(command: Buffer): Promise<void> {
		if(this.data.debug) debug('MASTERSERVER sent:', command);

		return new Promise((res, rej) => {
			socket.send(
				Buffer.from(command),
				this.data.port,
				this.data.ip,
				err => {
					if(err) return rej(err);
					res();
				}
			);
		});
	}

	public async awaitResponse(responseHeaders: number[]): Promise<Buffer> {
		return new Promise((res, rej) => {
			const clear = (): void => {
				/* eslint-disable @typescript-eslint/no-use-before-define */
				socket.off('packet', onPacket);
				socket.off('error', onError);
				clearTimeout(timeout);
				/* eslint-enable @typescript-eslint/no-use-before-define */
			};

			const onError = (err: unknown): void => {
				clear(); rej(err);
			};
			const onPacket = (buffer: Buffer): void => {
				if(!responseHeaders.includes(buffer[0]!)) return;

				clear(); res(buffer);
			};

			const timeout = setTimeout(onError, this.data.timeout, new Error('Response timeout.'));

			socket.on('packet', onPacket);
			socket.on('error', onError);
		});
	}

	public async query(command: Buffer, ...responseHeaders: number[]): Promise<Buffer> {
		await this.send(command);

		const timeout = setTimeout(() => {
			this.send(command).catch(() => { /* do nothing */ });
		}, this.data.timeout / 2)
			.unref();

		return await this.awaitResponse(responseHeaders)
			.finally(() => clearTimeout(timeout));
	}
}
