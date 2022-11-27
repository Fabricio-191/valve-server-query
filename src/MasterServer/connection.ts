import { debug } from '../utils';
import { createSocket, type Socket, type RemoteInfo } from 'dgram';

import type { MasterServerData } from './options';

const connections = new Map<string, Connection>();
const sockets: Record<4 | 6, Socket | null> = {
	4: null,
	6: null,
};

function getSocket(ipFormat: 4 | 6): Socket {
	if(sockets[ipFormat] !== null) return sockets[ipFormat] as Socket;

	sockets[ipFormat] = createSocket(`udp${ipFormat}`)
		.on('message', handleMessage)
		.unref();

	return sockets[ipFormat]!;
}

function handleMessage(buffer: Buffer, rinfo: RemoteInfo): void {
	const connection = connections.get(`${rinfo.address}:${rinfo.port}`);
	if(!connection) return;

	if(connection.data.debug) debug('MASTERSERVER recieved:', buffer);

	const header = buffer.readInt32LE();
	if(header !== -1){
		if(header === -2){
			throw new Error('Multi-packet not supported');
		}else{
			throw new Error('Invalid packet');
		}
	}

	connection.socket.emit('packet', buffer.slice(4));
}

export default class Connection {
	constructor(data: MasterServerData) {
		this.data = data;
	}
	public socket!: Socket;
	public readonly data: MasterServerData;

	public connect(): void {
		this.socket = getSocket(this.data.ipFormat);
		this.socket.setMaxListeners(this.socket.getMaxListeners() + 10);
		connections.set(this.data.address, this);
	}

	public destroy(): void {
		this.socket.setMaxListeners(this.socket.getMaxListeners() - 10);
		connections.delete(this.data.address);
	}

	public async send(command: Buffer): Promise<void> {
		if(this.data.debug) debug('MASTERSERVER sent:', command);

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
