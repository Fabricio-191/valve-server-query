import { debug, BufferReader, type Options } from '../utils';
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

export interface MetaData {
	appID: number;
	multiPacketGoldSource: boolean;
	protocol: number;
	info: {
		challenge: boolean;
		goldSource: boolean;
	};
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

	connection.emit('packet', packet);
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function packetHandler(buffer: Buffer, connection: Connection): Buffer | void {
	const header = buffer.readInt32LE();

	if(header === -1) return buffer.slice(4);
	if(header === -2 && connection.meta !== null){
		const { meta, options, packetsQueues } = connection;

		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
		// only valid in the first packet
			connection.meta.multiPacketGoldSource = true;
		}

		const packet = parseMultiPacket(buffer, meta);

		if(!(packet.ID in packetsQueues)){
			packetsQueues[packet.ID] = [packet];
			return;
		}

		if(options.debug && buffer.length > 13 && buffer.readInt32LE(9) === -1){
			debug('SERVER changed packet parsing in not the first recieved packet');
		}

		const queue = packetsQueues[packet.ID] as [MultiPacket, ...MultiPacket[]];
		if(queue.push(packet) !== packet.packets.total) return;

		delete packetsQueues[packet.ID];

		// Checks that all the packets were parsed as goldsource
		if(meta.multiPacketGoldSource){
			for(let i = 0; i < queue.length; i++){
				const p = queue[i] as MultiPacket;

				if(p.goldSource) continue;
				queue[i] = parseMultiPacket(p.raw, meta);
			}
		}

		const payloads = queue
			.sort((p1, p2) => p1.packets.current - p2.packets.current)
			.map(p => p.payload);

		return packetHandler(Buffer.concat(payloads), connection);
	}

	if(connection.options.debug) debug('SERVER cannot parse multi-packet', buffer);
	if(connection.options.enableWarns){
		// eslint-disable-next-line no-console
		console.error(new Error("Warning: a multi-packet couln't be handled"));
	}
}

interface MultiPacket {
	ID: number;
	packets: {
		current: number;
		total: number;
	};
	goldSource: boolean;
	payload: Buffer;
	raw: Buffer;
	// bzip?: true;
}

const MPS_IDS = [ 215, 17550, 17700, 240 ] as const;
function parseMultiPacket(buffer: Buffer, meta: MetaData): MultiPacket {
	const reader = new BufferReader(buffer, 4);
	const ID = reader.long(), packets = reader.byte();

	if(meta.multiPacketGoldSource) return {
		ID,
		packets: {
			current: packets >> 4,
			total: packets & 0x0F,
		},
		payload: reader.remaining(),
		goldSource: true,
		raw: buffer,
	};

	// @ts-expect-error payload will be added later
	const info: MultiPacket = {
		ID,
		packets: {
			total: packets,
			current: reader.byte(),
		},
		goldSource: false,
		raw: buffer,
	};

	// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
	if(!(meta.protocol === 7 && MPS_IDS.includes(meta.appID))){
		// info.maxPacketSize = reader.short();
		reader.offset += 2;
	}

	if(info.packets.current === 0 && info.ID & 0x80000000){
		// eslint-disable-next-line no-console
		console.warn('Bzip decompression is for old engines and it could be supported but i didn\'t found any server to test it, so if you need it you could hand me the ip and port of the server so i can add it and test it');

		throw new Error('BZip is not supported');

		/*
		info.bzip = {
			uncompressedSize: reader.long(),
			CRC32_sum: reader.long(),
		};

		reader.offset += 8;
		info.bzip = true;
		*/
	}

	info.payload = reader.remaining();

	return info;
}
// #endregion

export default class Connection extends EventEmitter{
	constructor(options: Options, meta: MetaData){
		super();
		this.options = options;
		this.meta = meta;

		this.address = `${options.ip}:${options.port}`;
		connections[this.address] = this;

		this.client = getClient(options.ipFormat);
	}
	public readonly address: string;
	public readonly options: Options;
	private readonly client: Socket;

	public meta: MetaData;
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
			const onPacket = (buffer: Buffer): void => {
				if(
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