import { debug } from './utils';
import { createSocket, type Socket } from 'dgram';
import type { BaseData } from './options';

export default abstract class BaseConnection<Data extends BaseData> {
	constructor(data: Data) {
		this.data = data;

		this.socket = createSocket('udp4')
			.on('message', buffer => {
				debug(this.data, 'recieved:', buffer);

				// some old servers just thought it would be a good idea to send empty useless packets in very rare occasions
				if(buffer.length !== 0) this.onMessage(buffer);
			})
			.unref();
	}
	public readonly data: Data;
	protected readonly socket: Socket;

	protected abstract onMessage(buffer: Buffer): void;

	public async connect(): Promise<void> {
		this.socket.connect(this.data.port, this.data.ip);

		await this._awaitEvent('connect', 'Connection timeout.');
	}

	public destroy(): void {
		this.socket.close();
	}

	private async send(command: Buffer): Promise<void> {
		debug(this.data, 'sent:', command);

		return new Promise((res, rej) => {
			this.socket.send(command, err => {
				if(err) rej(err);
				else res();
			});
		});
	}

	private _awaitEvent<T>(
		event: string,
		timeoutMsg: string,
		filter: ((arg: T) => boolean) | null = null,
		tiemoutTime = this.data.timeout
	): Promise<T> {
		return new Promise((res, rej) => {
			const clear = (): void => {
				/* eslint-disable @typescript-eslint/no-use-before-define */
				this.socket
					.off(event, onEvent)
					.off('error', onError);

				clearTimeout(timeout);
				/* eslint-enable @typescript-eslint/no-use-before-define */
			};

			const onError = (err: unknown): void => {
				clear(); rej(err);
			};
			const onEvent = (arg: T): void => {
				if(filter === null || filter(arg)){
					clear(); res(arg);
				}
			};

			const timeout = setTimeout(onError, tiemoutTime, new Error(timeoutMsg));
			this.socket
				.on(event, onEvent)
				.on('error', onError);
		});
	}

	public awaitResponse(responseHeaders: readonly number[], timeoutTime = this.data.timeout): Promise<Buffer> {
		return this._awaitEvent<Buffer>(
			'packet',
			'Response timeout.',
			buffer => responseHeaders.includes(buffer[0]!),
			timeoutTime
		);
	}

	public _lastPing = -1;
	protected async query(command: Buffer, responseHeaders: readonly number[]): Promise<Buffer> {
		return new Promise((res, rej) => {
			const interval = setInterval(() => {
				this.send(command).catch(() => { /* do nothing */ });
			}, this.data.timeout / 3).unref();

			const start = Date.now();
			this.send(command)
				.then(() => this.awaitResponse(responseHeaders))
				.then(buffer => {
					this._lastPing = Date.now() - start;
					res(buffer);
				})
				.catch(rej)
				.finally(() => clearInterval(interval));
		});
	}
}