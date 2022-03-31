import { debug, decompressBZip, type BufferLike } from '../utils/utils';
import { BufferReader } from '../utils/utils';
import { EventEmitter } from 'events';
import { createSocket } from 'dgram';

export interface BaseOptions {
	ip: string;
	port: number;
	timeout: number;
	debug: boolean;
	enableWarns: boolean;
}

const connections: Record<string, Connection> = {};
const client = createSocket('udp4')
	.on('message', (buffer, rinfo) => {
		if(buffer.length === 0) return;

		const address = `${rinfo.address}:${rinfo.port}`;

		if(!(address in connections)) return;
		const connection = connections[address] as Connection;

		if(connection.options.debug) debug(connection._meta ? 'SERVER' : 'MASTER_SERVER', 'recieved:', buffer);

		const packet = packetHandler(buffer, connection);
		if(!packet) return;

		connection.emit('packet', packet, address);
	})
	.unref();

export default class Connection extends EventEmitter{
	constructor(options, _meta){
		super();
		this.options = options;
		this._meta = _meta;

		this.address = `${options.ip}:${options.port}`;
		connections[this.address] = this;

		client.setMaxListeners(client.getMaxListeners() + 20);
	}
	private readonly address: string;
	private readonly options: BaseOptions;

	private readonly _meta = null;
	private readonly packetsQueues = {};
	public lastPing = -1;

	public send(command: BufferLike): Promise<void> {
		if(this.options.debug) debug(this._meta ? 'SERVER' : 'MASTER_SERVER', 'sent:', command);

		return new Promise((res, rej) => {
			client.send(
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
				client.off('error', onError);
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
			client.on('error', onError);
		});
	}
	/* eslint-enable @typescript-eslint/no-use-before-define */

	public async query(command: BufferLike, ...responseHeaders: number[]): Promise<Buffer> {
		await this.send(command);

		const timeout = setTimeout(() => {
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
		client.setMaxListeners(client.getMaxListeners() - 20);
		delete connections[this.address];
	}
}

function packetHandler(buffer: Buffer, connection: Connection): Buffer | void {
	const { options } = connection;
	if(buffer.readInt32LE() === -2){
		const { _meta, packetsQueues } = connection;

		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
			// only valid in the first packet
			_meta.multiPacketResponseIsGoldSource = true;
		}

		let packet: MultiPacket | null = null;
		try{
			packet = multiPacketResponse(buffer, _meta);
		}catch(e){
			if(options.debug) debug('SERVER', 'cannot parse packet', buffer);
			if(options.enableWarns){
				console.error(new Error("Warning: a packet couln't be handled"));
			}
			return;
		}
		if(!(packet.ID in packetsQueues)){
			packetsQueues[packet.ID] = [packet];
			return;
		}

		const queue = packetsQueues[packet.ID] as MultiPacket[];
		if(queue.push(packet) !== packet.packets.total) return;

		delete packetsQueues[packet.ID];

		if(_meta.multiPacketResponseIsGoldSource && queue.some(p => !p.goldSource)){
			queue = queue.map(p => multiPacketResponse(p.raw, _meta));
		}

		const payloads = queue
			.sort((p1, p2) => p1.packets.current - p2.packets.current)
			.map(p => p.payload);

		buffer = Buffer.concat(payloads);

		if(queue[0].bzip){
			if(options.debug) debug('SERVER', `BZip ${connection.ip}:${connection.port}`, buffer);
			buffer = decompressBZip(buffer);
		}
		/*
		I never tried bzip decompression, if you are having trouble with this, contact me on discord
		Fabricio-191#8051, and please send me de ip and port of the server, so i can do tests
		*/
	}

	if(buffer.readInt32LE() === -1) return buffer.slice(4);

	if(options.debug) debug('SERVER', 'cannot parse packet', buffer);
	if(options.enableWarns){
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
	maxPacketSize?: number;
	bzip?: {
		uncompressedSize: number;
		CRC32_sum: number;
	};
}

const MPS_IDS = [ 215, 17550, 17700 ];
function multiPacketResponse(buffer: Buffer, _meta): MultiPacket {
	const reader = new BufferReader(buffer, 4);
	const ID = reader.long(), packets = reader.byte();

	if(_meta.multiPacketResponseIsGoldSource){
		return {
			ID,
			packets: {
				current: (packets & 0xF0) >> 4,
				total: packets & 0x0F,
			},
			payload: reader.remaining(),
			goldSource: true,
			raw: buffer,
		};
	}

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

	if(
		!MPS_IDS.includes(_meta.appID) &&
		!(_meta.appID === 240 && _meta.protocol === 7)
	){
		info.maxPacketSize = reader.short();
	}

	if(info.packets.current === 0 && info.ID & 0x80000000){ // 10000000 00000000 00000000 00000000
		info.bzip = {
			uncompressedSize: reader.long(),
			CRC32_sum: reader.long(),
		};
	}

	info.payload = reader.remaining();

	return info;
}
