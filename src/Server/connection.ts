import { debug, BufferReader, getClient, type Options } from '../utils';
import { EventEmitter } from 'events';
import type { RemoteInfo, Socket } from 'dgram';

export interface MetaData {
	appID: number;
	multiPacketResponseIsGoldSource: boolean;
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

	connection.emit('packet', packet, address);
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function packetHandler(buffer: Buffer, connection: Connection): Buffer | void {
	if(buffer.readInt32LE() === -2){
		const { meta, options, packetsQueues } = connection;

		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
			// only valid in the first packet
			meta.multiPacketResponseIsGoldSource = true;
		}

		let packet: MultiPacket | null = null;
		try{
			packet = multiPacketResponse(buffer, meta);
		}catch(e){
			if(options.debug) debug('SERVER cannot parse packet', buffer);
			if(options.enableWarns){
				// eslint-disable-next-line no-console
				console.error(new Error("Warning: a packet couldn't be handled"));
			}
			return;
		}

		if(options.debug && buffer.length > 13 && buffer.readInt32LE(9) === -1 && packet.ID in packetsQueues){
			debug('SERVER changed packet parsing in not the first recieved packet');
		}

		if(!(packet.ID in packetsQueues)){
			packetsQueues[packet.ID] = [packet];
			return;
		}

		const queue = packetsQueues[packet.ID] as [MultiPacket, ...MultiPacket[]];
		if(queue.push(packet) !== packet.packets.total) return;

		delete packetsQueues[packet.ID];

		if(meta.multiPacketResponseIsGoldSource){ // Checks that all the packets were parsed as goldsource
			for(let i = 0; i < queue.length; i++){
				const p = queue[i] as MultiPacket;

				if(!p.goldSource){
					queue[i] = multiPacketResponse(p.raw, meta);
				}
			}
		}

		const payloads = queue
			.sort((p1, p2) => p1.packets.current - p2.packets.current)
			.map(p => p.payload);

		buffer = Buffer.concat(payloads);
	}

	if(buffer.readInt32LE() === -1) return buffer.slice(4);

	if(connection.options.debug) debug('SERVER cannot parse packet', buffer);
	if(connection.options.enableWarns){
		// eslint-disable-next-line no-console
		console.error(new Error("Warning: a packet couln't be handled"));
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
function multiPacketResponse(buffer: Buffer, meta: MetaData): MultiPacket {
	const reader = new BufferReader(buffer, 4);
	const ID = reader.long(), packets = reader.byte();

	if(meta.multiPacketResponseIsGoldSource) return {
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
	constructor(options: Options){
		super();
		this.options = options;

		this.address = `${options.ip}:${options.port}`;
		connections[this.address] = this;

		this.client = getClient(options.ipFormat, handleMessage);
	}
	public readonly address: string;
	public readonly options: Options;
	private readonly client: Socket;

	public readonly meta!: MetaData;
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