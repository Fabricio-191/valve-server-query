import { debug } from './utils';
import { createSocket, type Socket } from 'dgram';

import type { BaseData } from './options';

export default abstract class BaseConnection {
	constructor(data: BaseData) {
		this.data = data;

		this.socket = createSocket(`udp${this.data.ipFormat}`)
			.on('message', buffer => {
				if(this.data.debug) debug('recieved:', buffer);
				this.onMessage(buffer);
			})
			.unref();
	}
	public readonly data: BaseData;
	protected readonly socket: Socket;

	protected abstract onMessage(buffer: Buffer): void;

	public connect(): Promise<void> {
		return new Promise((res, rej) => {
			// @ts-expect-error asdasdasd
			this.socket.connect(this.data.port, this.data.ip, (err: unknown) => {
				if(err) return rej(err);
				res();
			});
		});
	}

	public destroy(): void {
		this.socket.close();
	}

	public async send(command: Buffer): Promise<void> {
		if(this.data.debug) debug('sent:', command);

		return new Promise((res, rej) => {
			this.socket.send(
				Buffer.from(command),
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
				this.socket.off('packet', onPacket);
				this.socket.off('error', onError);
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

			this.socket.on('packet', onPacket);
			this.socket.on('error', onError);
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