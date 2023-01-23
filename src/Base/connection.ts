import { debug } from './utils';
import { createSocket, type Socket } from 'dgram';
import type { BaseData } from './options';

export default abstract class BaseConnection<Data extends BaseData> {
	constructor(data: Data) {
		this.data = data;
		this.socket = createSocket('udp4')
			.on('message', buffer => {
				debug(this.data, 'recieved:', buffer);

				if(buffer.length > 4) this.onMessage(buffer);
			})
			.unref();
	}
	public data: Data;
	protected readonly socket: Socket;
	private _connected: Promise<void> | false = false;

	protected abstract onMessage(buffer: Buffer): void;

	public async connect(): Promise<void> {
		if(this._connected) return this._connected;

		this.socket.connect(this.data.port, this.data.ip);

		this._connected = this._awaitEvent('connect', 'Connection timeout.');
		await this._connected;
	}

	public async destroy(): Promise<void> {
		try{
			await this._connected;
		}catch{
			return;
		}

		this.socket.disconnect();
		this.socket.close();
		await this._awaitEvent('close', 'Disconnection timeout.');

		this._connected = false;
	}

	public async send(command: Buffer): Promise<void> {
		await this.connect();

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

	public query(command: Buffer, responseHeaders: readonly number[]): Promise<Buffer> {
		return this.send(command).then(() => this.awaitResponse(responseHeaders));
	}
}