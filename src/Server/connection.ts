import { debug, BufferReader } from '../Base/utils';
import { type RawServerOptions, type ServerData, parseServerOptions } from '../Base/options';
import BaseConnection from '../Base/connection';
import type { NonEmptyArray, ValueIn } from '../Base/utils';

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

const MPS_IDS = Object.freeze([ 215, 240, 17550, 17700 ]);

export const responsesHeaders = {
	ANY_INFO_OR_CHALLENGE: [0x6D, 0x49, 0x41],
	INFO: [0x49],
	GLDSRC_INFO: [0x6D],
	PLAYERS_OR_CHALLENGE: [0x44, 0x41],
	RULES_OR_CHALLENGE: [0x45, 0x41],
} as const;
export type ResponseHeaders = ValueIn<typeof responsesHeaders>;

export default class Connection extends BaseConnection {
	public readonly data!: ServerData;
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
		/*
		First packets in each multi-packet:
		GoldSource: 4 bytes header + 4 bytes id + 1 byte packets nums + PAYLOADSTARTSHERE
		Source:     4 bytes header + 4 bytes id + 1 byte total packets + 1 byte current packet + 2 bytes size (optional) + PAYLOADSTARTSHERE

		Payloads always start with a ff ff ff ff header
		the gouldsource payload starts at byte 9
		The source payload starts at byte 10 or 12

		If it's the first multi packet, and it's goldsource, at byte 9 it's going to be the -1 header
		*/
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

		const payloads = queue
			.sort((p1, p2) => p1.packets.current - p2.packets.current)
			.map(p => p.payload);

		this.socket.emit('message', Buffer.concat(payloads));
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
			throw new Error('BZip is not supported (make an issue in github if you want it)');
			/*
			I have queried almost every server possible and I have never seen a server that uses bzip.
			*/
		}

		info.payload = reader.remaining();

		return info;
	}

	public lastPing = -1;
	public async query(command: Buffer, responseHeaders: ResponseHeaders): Promise<Buffer> {
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

	public async makeQuery(command: (key?: Buffer) => Buffer, responseHeaders: ResponseHeaders): Promise<Buffer> {
		await this.mustBeConnected();

		let buffer = await this.query(command(), responseHeaders);
		let attempt = 0;

		// if the response has a 0x41 header it means it needs challenge
		// some servers need multiple challenges to accept the query
		while(buffer[0] === 0x41 && attempt < 5){
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
