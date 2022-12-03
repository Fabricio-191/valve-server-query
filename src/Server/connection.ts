import { debug, BufferReader } from '../Base/utils';
import type { ServerData } from '../Base/options';
import BaseConnection from '../Base/connection';

// #region packetHandler
function handleMultiplePackets(buffer: Buffer, connection: Connection): Buffer | null {
	/*
	First packets in each multi-packet:
	GoldSource: 4 bytes header + 4 bytes id + 1 byte packets nums + PAYLOADSTARTSHERE
	Source:     4 bytes header + 4 bytes id + 1 byte total packets + 1 byte current packet + 2 bytes size + PAYLOADSTARTSHERE

	Payloads always start with a -1 header
	the gouldsource payload starts at byte 9
	The source payload starts at byte 10 or 12

	If it's the first multi packet, and it's goldsource, at byte 9 it's going to be the -1 header
	*/
	if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
		connection.data.multiPacketGoldSource = true;
	}

	const packet = parseMultiPacket(buffer, connection.data);

	if(!(packet.ID in connection.packetsQueues)){
		connection.packetsQueues[packet.ID] = [packet];
		return null;
	}

	if(connection.data.debug && buffer.length > 13 && buffer.readInt32LE(9) === -1){
		debug('SERVER changed packet parsing in not the first recieved packet');
	}

	const queue = connection.packetsQueues[packet.ID]!;
	if(queue.push(packet) !== packet.packets.total) return null;

	delete connection.packetsQueues[packet.ID];

	if(connection.data.multiPacketGoldSource){
		// Checks that all the packets were parsed as goldsource
		for(let i = 0; i < queue.length; i++){
			const p = queue[i] as MultiPacket;

			if(p.goldSource) continue;
			queue[i] = parseMultiPacket(p.raw, connection.data);
		}
	}

	const payloads = queue
		.sort((p1, p2) => p1.packets.current - p2.packets.current)
		.map(p => p.payload);

	return Buffer.concat(payloads);
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

const MPS_IDS = [ 215, 240, 17550, 17700 ] as const;
function parseMultiPacket(buffer: Buffer, data: ServerData): MultiPacket {
	const reader = new BufferReader(buffer, 4);
	const ID = reader.long(), packets = reader.byte();

	if(data.multiPacketGoldSource) return {
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
	if(!(data.protocol === 7 && MPS_IDS.includes(data.appID))){
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
// #endregion

export default class Connection extends BaseConnection {
	public readonly data!: ServerData;
	public readonly packetsQueues: Record<number, [MultiPacket, ...MultiPacket[]]> = {};

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			this.socket.emit('packet', buffer.slice(4));
		}else if(header === -2){
			const packet = handleMultiplePackets(buffer, this);
			if(packet) this.socket.emit('packet', packet);
		}else{
			if(this.data.debug) debug('SERVER cannot parse packet', buffer);
			if(this.data.enableWarns){
				// eslint-disable-next-line no-console
				console.warn("Warning: a packet couln't be handled");
			}
		}
	}

	public lastPing = -1;
	public async query(command: Buffer, ...responseHeaders: number[]): Promise<Buffer> {
		await this.send(command);

		const start = Date.now();
		const timeout = setTimeout(() => {
			this.send(command).catch(() => { /* do nothing */ });
		}, this.data.timeout / 2)
			.unref();

		const buffer = await this.awaitResponse(responseHeaders)
			.finally(() => clearTimeout(timeout));

		this.lastPing = Date.now() - start;

		return buffer;
	}
}
