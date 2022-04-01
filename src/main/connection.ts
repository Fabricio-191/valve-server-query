import { debug, type BufferLike } from '../utils';
import { BufferReader } from '../utils';
import { EventEmitter } from 'events';
import { createSocket } from 'dgram';

export interface BaseOptions {
	ip: string;
	port: number;
	timeout: number;
	debug: boolean;
	enableWarns: boolean;
}

export async function parseBaseOptions(options: BaseOptions): Promise<BaseOptions> {
	if(typeof options !== 'object'){
		throw Error("'options' must be an object");
	}

	if(
		typeof options.port !== 'number' ||
		isNaN(options.port) ||
		options.port < 0 ||
		options.port > 65535
	){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof options.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof options.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(isNaN(options.timeout) || options.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}

	// const { ip, format } = await resolveIP(options.ip);

	return options;
}

export interface MetaData {
	appID: number;
	multiPacketResponseIsGoldSource: boolean;
	protocol: number;
	info: {
		challenge: boolean;
		goldSource: boolean;
	};
}

const connections: Record<string, Connection> = {};
const client = createSocket('udp4')
	.on('message', (buffer, rinfo) => {
		if(buffer.length === 0) return;

		const address = `${rinfo.address}:${rinfo.port}`;

		if(!(address in connections)) return;
		const connection = connections[address] as Connection;

		if(connection.options.debug) debug(connection.meta ? 'SERVER' : 'MASTER_SERVER', 'recieved:', buffer);

		const packet = packetHandler(buffer, connection);
		if(!packet) return;

		connection.emit('packet', packet, address);
	})
	.unref();

// #region Packet Handlers
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function packetHandler(buffer: Buffer, connection: Connection): Buffer | void {
	const { options } = connection;
	if(buffer.readInt32LE() === -2){
		const { meta, packetsQueues } = connection;

		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
			// only valid in the first packet
			meta.multiPacketResponseIsGoldSource = true;
		}

		let packet: MultiPacket | null = null;
		try{
			packet = multiPacketResponse(buffer, meta);
		}catch(e){
			if(options.debug) debug('SERVER', 'cannot parse packet', buffer);
			if(options.enableWarns){
				// eslint-disable-next-line no-console
				console.error(new Error("Warning: a packet couldn't be handled"));
			}
			return;
		}

		if(options.debug && buffer.length > 13 && buffer.readInt32LE(9) === -1 && packet.ID in packetsQueues){
			debug('RCON', 'changed packet parsing in not the first recieved packet');
		}

		if(!(packet.ID in packetsQueues)){
			packetsQueues[packet.ID] = [packet];
			return;
		}

		const queue = packetsQueues[packet.ID] as [MultiPacket, ...MultiPacket[]];
		if(queue.push(packet) !== packet.packets.total) return;

		delete packetsQueues[packet.ID];

		if(meta.multiPacketResponseIsGoldSource){ // Checks that all the packets are parsed as goldsource
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

		if(queue[0].bzip){
			if(options.debug) debug('SERVER', `BZip ${options.ip}:${options.port}`, buffer);
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
	bzip?: true;
}

const MPS_IDS = [ 215, 17550, 17700, 240 ] as readonly number[];
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

	if(!(MPS_IDS.includes(meta.appID) && meta.protocol === 7)){
		// info.maxPacketSize = reader.short();
		reader.offset += 2;
	}

	if(info.packets.current === 0 && info.ID & 0x80000000){ // 10000000 00000000 00000000 00000000
		/*
		info.bzip = {
			uncompressedSize: reader.long(),
			CRC32_sum: reader.long(),
		};
		*/

		reader.offset += 8;
		info.bzip = true;
	}

	info.payload = reader.remaining();

	return info;
}
// #endregion

export default class Connection extends EventEmitter{
	constructor(options: BaseOptions, meta: MetaData | null = null){
		super();
		this.options = options;
		this.meta = meta;

		this.address = `${options.ip}:${options.port}`;
		connections[this.address] = this;

		client.setMaxListeners(client.getMaxListeners() + 20);
	}
	public readonly address: string;
	public readonly options: BaseOptions;

	public readonly meta: MetaData;
	public readonly packetsQueues = {};
	public lastPing = -1;

	public send(command: BufferLike): Promise<void> {
		if(this.options.debug) debug(this.meta ? 'SERVER' : 'MASTER_SERVER', 'sent:', command);

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
		client.setMaxListeners(client.getMaxListeners() - 20);
		delete connections[this.address];
	}
}