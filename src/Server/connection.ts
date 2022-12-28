import { debug, BufferReader } from '../Base/utils';
import type { ServerData } from '../Base/options';
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

const MPS_IDS = [ 215, 240, 17550, 17700 ] as const;

export const ResponsesHeaders = {
	CHALLENGE: [0x41],
	PLAYERS: [0x44],
	RULES: [0x45],
	INFO: [0x49],
	PING: [0x6A],
	GOLDSOURCE_INFO: [0x6D],
	PLAYERS_OR_CHALLENGE: [0x44, 0x41],
	RULES_OR_CHALLENGE: [0x45, 0x41],
	INFO_OR_CHALLENGE: [0x49, 0x41],
	ANY_INFO_OR_CHALLENGE: [0x6D, 0x49, 0x41],
	ANY_INFO: [0x6D, 0x49],
} as const;
type ResponseHeaders = ValueIn<typeof ResponsesHeaders>;

export default class Connection extends BaseConnection {
	public readonly data!: ServerData;
	private readonly packetsQueues: Map<number, NonEmptyArray<MultiPacket>> = new Map();

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			this.socket.emit('packet', buffer.slice(4));
		}else if(header === -2){
			const packet = this.handleMultiplePackets(buffer);
			if(packet) this.onMessage(packet);
		}else{
			debug(this.data, 'SERVER cannot parse packet', buffer);
			if(this.data.enableWarns){
				// eslint-disable-next-line no-console
				console.warn("Warning: a packet couln't be handled");
			}
		}
	}

	private handleMultiplePackets(buffer: Buffer): Buffer | null {
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
			return null;
		}

		const queue = this.packetsQueues.get(packet.ID)!;
		if(queue.push(packet) !== packet.packets.total) return null;

		this.packetsQueues.delete(packet.ID);

		if(this.data.multiPacketGoldSource){
			// Checks that all the packets were parsed as goldsource
			for(let i = 0; i < queue.length; i++){
				const p = queue[i] as MultiPacket;

				if(p.goldSource) continue;
				queue[i] = this._parseMultiPacket(p.raw);
			}
		}

		const payloads = queue
			.sort((p1, p2) => p1.packets.current - p2.packets.current)
			.map(p => p.payload);

		return Buffer.concat(payloads);
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

		// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
		if(!(this.data.protocol === 7 && MPS_IDS.includes(this.data.appID))){
			// info.maxPacketSize = reader.short();
			reader.addOffset(2);
		}

		if(info.packets.current === 0 && info.ID & 0x80000000){
			throw new Error('BZip is not supported');
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
}

/*
// eslint-disable-next-line no-promise-executor-return
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function retries(fn: () => Promise<void>, retries: number, delayTime: number): Promise<void> {
	return fn().catch(err => {
		if(retries === 0) throw err;
		return delay(delayTime).then(() => retries(fn, retries - 1, delayTime));
	});
}
*/