import { debug, type Options } from '../utils';
import { EventEmitter } from 'events';
import { createSocket, type RemoteInfo, type Socket, type SocketType } from 'dgram';

const clients: Record<number, Socket> = {};
export function getClient(format: 4 | 6): Socket {
	if(format in clients){
		const client = clients[format] as Socket;

		client.setMaxListeners(client.getMaxListeners() + 20);
		return client;
	}

	const client = createSocket(`udp${format}` as SocketType)
		.on('message', handleMessage)
		.setMaxListeners(20)
		.unref();

	clients[format] = client;
	return client;
}

// #region
const connections: Record<string, Connection> = {};
function handleMessage(buffer: Buffer, rinfo: RemoteInfo): void {
	if(buffer.length === 0) return;

	const address = `${rinfo.address}:${rinfo.port}`;

	if(!(address in connections)) return;
	const connection = connections[address] as Connection;

	if(connection.options.debug) debug('SERVER recieved:', buffer);

	const packet = packetHandler(buffer, connection);
	if(!packet) return;

	connection.emit('packet', packet, address);
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function packetHandler(buffer: Buffer, connection: Connection): Buffer | void {
	const header = buffer.readInt32LE();

	if(header === -1) return buffer.slice(4);
	if(connection.options.debug) debug('MASTERSERVER cannot parse multi-packet', buffer);
	if(connection.options.enableWarns){
		// eslint-disable-next-line no-console
		console.error(new Error('MASTERSERVER cannot parse multi-packet'));
	}
}
// #endregion

export default class Connection extends EventEmitter{
	constructor(options: Options){
		super();
		this.options = options;

		this.address = `${options.ip}:${options.port}`;
		connections[this.address] = this;

		this.client = getClient(options.ipFormat);
	}
	public readonly address: string;
	public readonly options: Options;
	private readonly client: Socket;

	public readonly packetsQueues = {};
	public lastPing = -1;

	public send(command: Buffer): Promise<void> {
		if(this.options.debug) debug('SERVER sent:', command);

		return new Promise((res, rej) => {
			this.client.send(
				Buffer.from(command),
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
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			this.send(command).catch(() => {});
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