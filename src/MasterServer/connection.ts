import { debug } from '../utils';
import { createSocket, type Socket, type RemoteInfo } from 'dgram';
import type { Data } from './masterServer';

const connections = new Map<string, Connection>();
const sockets: Record<4 | 6, Socket | null> = {
	4: null,
	6: null,
};

function handleMessage(buffer: Buffer, rinfo: RemoteInfo): void {
	const connection = connections.get(`${rinfo.address}:${rinfo.port}`);
	if(!connection) return;

	if(connection.data.debug) debug('recieved:', buffer);

	const header = buffer.readInt32LE();
	if(header === -1){
		connection.socket.emit('packet', buffer.slice(4));
	}else{
		if(connection.data.debug) debug('MASTERSERVER cannot parse multi-packet', buffer);
		if(connection.data.enableWarns){
			// eslint-disable-next-line no-console
			console.error(new Error('MASTERSERVER cannot parse multi-packet'));
		}
	}
}

export default class Connection {
	constructor(data: Data) {
		this.data = data;
	}
	public socket!: Socket;
	public readonly packetsQueues = {};
	public readonly data: Data;

	public connect(): void {
		if(sockets[this.data.ipFormat] === null){
			sockets[this.data.ipFormat] = createSocket(`udp${this.data.ipFormat}`)
				.on('message', handleMessage)
				.unref();
		}

		this.socket = sockets[this.data.ipFormat]!;
		this.socket.setMaxListeners(this.socket.getMaxListeners() + 10);
		connections.set(this.data.address, this);
	}

	public destroy(): void {
		this.socket.setMaxListeners(this.socket.getMaxListeners() - 10);
		connections.delete(this.data.address);
	}

	public async send(command: Buffer): Promise<void> {
		if(this.data.debug) debug('sent:', command);

		return new Promise((res, rej) => {
			this.socket.send(
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

	/* eslint-disable @typescript-eslint/no-use-before-define */
	public async awaitResponse(responseHeaders: number[]): Promise<Buffer> {
		return new Promise((res, rej) => {
			const clear = (): void => {
				this.socket.off('packet', onPacket);
				this.socket.off('error', onError);
				clearTimeout(timeout);
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
	/* eslint-enable @typescript-eslint/no-use-before-define */

	public async query(command: Buffer, ...responseHeaders: number[]): Promise<Buffer> {
		await this.send(command);

		const timeout = setTimeout(() => {
			this.send(command)
				.catch(() => { /* do nothing */ });
		}, this.data.timeout / 2)
			.unref();

		return await this.awaitResponse(responseHeaders)
			.finally(() => clearTimeout(timeout));
	}
}
