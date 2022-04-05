import type { RemoteInfo, Socket } from 'dgram';
import { debug, getClient, type Options as BaseOptions } from '../utils';
import { EventEmitter } from 'events';

const connections: Record<string, Connection> = {};
function handleMessage(buffer: Buffer, rinfo: RemoteInfo): void {
	if(buffer.length === 0) return;

	const address = `${rinfo.address}:${rinfo.port}`;

	if(!(address in connections)) return;
	const connection = connections[address] as Connection;

	if(connection.options.debug) debug('MASTER_SERVER recieved:', buffer);

	if(buffer.readInt32LE() === -1){
		connection.emit('packet', buffer.slice(4), address);
	}else{
		if(connection.options.debug) debug('MASTER_SERVER cannot parse packet', buffer);
		if(connection.options.enableWarns){
			// eslint-disable-next-line no-console
			console.error(new Error("Warning: a packet couln't be handled"));
		}
	}
}

export default class Connection extends EventEmitter {
	constructor(options: BaseOptions){
		super();
		this.options = options;

		this.address = `${options.ip}:${options.port}`;
		connections[this.address] = this;

		this.client = getClient(options.ipFormat, handleMessage);
	}
	private readonly address: string;
	public readonly options: BaseOptions;
	private readonly client: Socket;
	public lastPing = -1;

	public send(command: Buffer): Promise<void> {
		if(this.options.debug) debug('MASTER_SERVER sent:', command);

		return new Promise((res, rej) => {
			this.client.send(
				command,
				this.options.port,
				this.options.ip,
				err => {
					if(err) return rej(err);
					res();
				}
			);
		});
	}

	/* eslint-disable @typescript-eslint/no-use-before-define */
	public awaitResponse(responseHeaders: number[]): Promise<Buffer> {
		return new Promise((res, rej) => {
			const clear = (): void => {
				this.off('packet', onPacket);
				this.client.off('error', onError);
				clearTimeout(timeout);
			};

			const onError = (err: unknown): void => {
				clear(); rej(err);
			};
			const onPacket = (buffer: Buffer, address: string): void => {
				if(
					this.address !== address ||
					!responseHeaders.includes(buffer[0] as number)
				) return;

				clear(); res(buffer);
			};

			const timeout = setTimeout(onError, this.options.timeout, new Error('Response timeout.'));

			this.on('packet', onPacket);
			this.client.on('error', onError);
		});
	}
	/* eslint-enable @typescript-eslint/no-use-before-define */

	public async query(command: Buffer, ...responseHeaders: number[]): Promise<Buffer> {
		await this.send(command);

		const timeout = setTimeout(() => {
			this.send(command)
				.catch(() => { /* do nothing */ });
		}, this.options.timeout / 2);

		const start = Date.now();
		return await this.awaitResponse(responseHeaders)
			.then(value => {
				this.lastPing = Date.now() - start;
				return value;
			})
			.finally(() => clearTimeout(timeout));
	}

	public destroy(): void {
		this.client.setMaxListeners(this.client.getMaxListeners() - 20);
		delete connections[this.address];
	}
}
