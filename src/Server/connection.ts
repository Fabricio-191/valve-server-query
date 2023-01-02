import { debug, BufferReader, type NonEmptyArray } from '../Base/utils';
import { type RawServerOptions, type ServerData, parseServerOptions } from '../Base/options';
import BaseConnection from '../Base/connection';
// @ts-expect-error no typings
import { decode } from 'seek-bzip';
import type { AnyServerInfo } from './parsers';
import { _getInfo } from './server';

interface MultiPacket {
	ID: number;
	packets: {
		current: number;
		total: number;
	};
	goldSource: boolean;
	payload: Buffer;
	raw: Buffer;
	bzip?: {
		uncompressedSize: number;
		CRC32_sum: number;
	};
}

const MPS_IDS = Object.freeze([ 215, 240, 17550, 17700 ]);

/*
https://github.com/cscott/seek-bzip
https://github.com/antimatter15/bzip2.js

const isBzip2 = (buffer: Buffer): boolean => {
	// return buffer.subarray(0, 3).toString() === 'BZh';
	// return buffer.subarray(0, 3).equals(Buffer.from('BZh'));

	if(buffer.length < 4) return false;
	return buffer[0] === 0x42 && buffer[1] === 0x5A && buffer[2] === 0x68;
};
*/

export default class Connection extends BaseConnection {
	public readonly data!: ServerData;
	public info!: AnyServerInfo;
	private readonly packetsQueues: Map<number, NonEmptyArray<MultiPacket>> = new Map();

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			this.socket.emit('packet', buffer.subarray(4));
		}else if(header === -2){
			this.handleMultiplePackets(buffer);
		}else{
			debug(this.data, 'SERVER cannot parse packet', buffer);
			if(this.data.enableWarns){
				// eslint-disable-next-line no-console
				console.warn("Warning: a packet couln't be handled");
			}
		}
	}

	private handleMultiplePackets(buffer: Buffer): void {
		if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
			this.data.multiPacketGoldSource = true;
			debug(this.data, 'SERVER changed packet parsing');
		}

		const packet = this._parseMultiPacket(buffer);
		if(!this.packetsQueues.has(packet.ID)){
			this.packetsQueues.set(packet.ID, [packet]);
			return;
		}

		let queue = this.packetsQueues.get(packet.ID)!;
		if(queue.push(packet) !== packet.packets.total) return;

		this.packetsQueues.delete(packet.ID);

		if(this.data.multiPacketGoldSource){
			queue = queue.map(p => {
				if(p.goldSource) return p;
				return this._parseMultiPacket(p.raw);
			}) as NonEmptyArray<MultiPacket>;
		}

		let payload = Buffer.concat(
			queue
				.sort((p1, p2) => p1.packets.current - p2.packets.current)
				.map(p => p.payload)
		);

		if(queue[0].bzip){
			try{
				// eslint-disable-next-line
				payload = decode(payload, queue[0].bzip.uncompressedSize);
			}catch(e){
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				debug(this.data, `SERVER bzip error: ${e instanceof Error ? e.message : e}`);
				if(this.data.enableWarns){
					// eslint-disable-next-line no-console
					console.warn('Warning: bzip error', e);
				}
			}
		}

		this.socket.emit('message', payload);
	}

	private _parseMultiPacket(buffer: Buffer): MultiPacket {
		const reader = new BufferReader(buffer, 4);
		const ID = reader.long(), packets = reader.byte();

		if(this.data.multiPacketGoldSource) return {
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

		if(!(this.data.protocol === 7 && MPS_IDS.includes(this.data.appID))){
			// info.maxPacketSize = reader.short();
			reader.addOffset(2);
		}

		if(info.packets.current === 0 && info.ID & 0x80000000){
			debug(this.data, 'SERVER bzip');
			info.bzip = {
				uncompressedSize: reader.long(),
				CRC32_sum: reader.long(),
			};
		}

		info.payload = reader.remaining();

		return info;
	}

	public lastPing = -1;
	public async query(command: Buffer, responseHeaders: readonly number[]): Promise<Buffer> {
		await this.send(command);
		let start = Date.now();

		const timeout = setTimeout(() => {
			this.send(command).catch(() => { /* do nothing */ });
			start = Date.now();
		}, this.data.timeout / 2)
			.unref();

		return await this.awaitResponse(responseHeaders)
			.finally(() => {
				clearTimeout(timeout);
				this.lastPing = Date.now() - start;
			});
	}

	public async makeQuery(command: (key?: Buffer) => Buffer, responseHeaders: readonly number[]): Promise<Buffer> {
		await this.mustBeConnected();

		let buffer = await this.query(command(), responseHeaders);
		let attempt = 0;

		// if the response has a 0x41 header it means it needs challenge
		// some servers need multiple challenges to accept the query
		while(buffer[0] === 0x41 && attempt < 10){
			buffer = await this.query(command(buffer.subarray(1)), responseHeaders);
			attempt++;
		}

		if(buffer[0] === 0x41) throw new Error('Wrong server response');

		return buffer;
	}

	public static async init(options: RawServerOptions): Promise<Connection> {
		const data = await parseServerOptions(options);
		const connection = new Connection(data);
		await connection.connect();
		return connection;
	}
}
