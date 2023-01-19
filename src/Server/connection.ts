import { BufferReader, optionalImport, debug } from '../Base/utils';
import { type RawServerOptions, type ServerData, parseServerOptions } from '../Base/options';
import BaseConnection from '../Base/connection';

interface SeekBzip {
	decode: (buffer: Buffer, uncompressedSize: number) => Buffer;
}

const seekBzip = optionalImport<SeekBzip>('seek-bzip');

function equals(buf1: Buffer, buf2: Buffer, start: number): boolean {
	const end = start + buf2.length;
	if(buf1.length < end) return false;

	return buf2.compare(buf1, start, end) === 0;
}

const bzipStart = Buffer.from('BZh'); // 42 5a 68
const header1 = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);

type PacketType = 'gldSrc' | 'src' | 'srcWithoutSize' | null;
function getMultiPacketType(buffer: Buffer, ID: number): PacketType { // works for first packet only
	if(equals(buffer, header1, 9)){
		const currentPacket = buffer.readUInt8(8) >> 4;
		if(currentPacket !== 0) return null;

		return 'gldSrc';
	}

	const currentPacket = buffer.readUInt8(9);
	if(currentPacket !== 0) return null;

	if(ID & 0x80000000){
		if(equals(buffer, bzipStart, 18)) return 'srcWithoutSize';
		if(equals(buffer, bzipStart, 20)) return 'src';
	}else{
		if(equals(buffer, header1, 10)) return 'srcWithoutSize';
		if(equals(buffer, header1, 12)) return 'src';
	}

	return null;
}

export class Connection extends BaseConnection<ServerData> {
	private readonly packetsQueues = new Map<number, {
		list: Buffer[];
		totalPackets: number;
		type: PacketType;
	}>();

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			if(buffer[4] === 0x6C){
				const reason = buffer.toString('utf8', 5, buffer.length - 1);
				const error = Object.assign(
					new Error('Banned by server'),
					{ reason, rawMessage: buffer }
				);

				this.socket.emit('error', error);
			}else{
				this.socket.emit('packet', buffer.subarray(4));
			}
		}else if(header === -2){
			this.handleMultiplePackets(buffer);
		}else{
			debug(this.data, 'cannot parse packet', buffer);
		}
	}

	protected handleMultiplePackets(buffer: Buffer): void {
		const packetID = buffer.readUInt32LE(4);

		if(!this.packetsQueues.has(packetID)){
			this.packetsQueues.set(packetID, {
				list: [],
				totalPackets: -1,
				type: null,
			});

			setTimeout(() => {
				if(this.packetsQueues.has(packetID)){
					const queue = this.packetsQueues.get(packetID)!;

					debug(this.data, 'multi packet not recieved completely', buffer.subarray(4, 8));
					debug(this.data, JSON.stringify(queue, null, '  '));
					this.packetsQueues.delete(packetID);
				}
			}, this.data.timeout).unref();
		}

		const queue = this.packetsQueues.get(packetID)!;
		queue.list.push(buffer);

		const packetType = getMultiPacketType(buffer, packetID);
		if(packetType){
			if(queue.type){
				debug(this.data, `multiple packets with different types: ${queue.type} and ${packetType}`);
				debug.save();
				throw new Error('Multiple packets with different types');
			}else{
				queue.type = packetType;
				queue.totalPackets = parsePacket(buffer, packetType).packets.total;
			}
		}

		if(queue.list.length === queue.totalPackets){
			const packets = queue.list.map(p => parsePacket(p, queue.type!));

			let payload = Buffer.concat(
				packets.sort((p1, p2) => p1.packets.current - p2.packets.current)
					.map(p => p.payload)
			);

			if('bzip' in packets[0]!){
				if(!seekBzip) throw new Error('optional dependency "seek-bzip" needed');

				payload = seekBzip.decode(payload, packets[0].bzip.uncompressedSize);
			}

			this.socket.emit('message', payload);
			this.packetsQueues.delete(packetID);
		}
		// const hasSizeField = this.data.protocol !== 7 || !MPS_IDS.includes(this.data.appID);
	}

	public async makeQuery(command: (key?: Buffer) => Buffer, responseHeaders: readonly number[]): Promise<Buffer> {
		let buffer = await this.query(command(), responseHeaders);
		let attempt = 0;

		// if the response has a 0x41 header it means it needs challenge
		// some servers need multiple challenges to accept the query
		while(buffer[0] === 0x41 && attempt < 30){
			buffer = await this.query(command(buffer.subarray(1)), responseHeaders);
			attempt++;
		}

		if(buffer[0] === 0x41) throw new Error('Wrong server response');

		return buffer;
	}
}

export default async function createConnection(options: RawServerOptions): Promise<Connection> {
	const data = await parseServerOptions(options);
	const connection = new Connection(data);
	await connection.connect();
	return connection;
}

interface GldSrcMultiPacket {
	ID: number;
	packets: {
		current: number;
		total: number;
	};
	goldSource: true;
	payload: Buffer;
}

interface SourceMultiPacket extends Omit<GldSrcMultiPacket, 'goldSource'> {
	goldSource: false;
	raw: Buffer;
	bzip?: {
		uncompressedSize: number;
		CRC32_sum: number;
	};
}

function parsePacket(buffer: Buffer, type: Exclude<PacketType, null>): GldSrcMultiPacket | SourceMultiPacket {
	const reader = new BufferReader(buffer, 4);
	const ID = reader.long(), packets = reader.byte();

	if(type === 'gldSrc') return {
		ID,
		packets: {
			current: packets >> 4,
			total: packets & 0x0F,
		},
		payload: reader.remaining(),
		goldSource: true,
	};

	// @ts-expect-error payload is added later
	const packet: SourceMultiPacket = {
		ID,
		packets: {
			total: packets,
			current: reader.byte(),
		},
		goldSource: false,
		raw: buffer,
	};

	if(type === 'src') reader.addOffset(2); // skip maxPacketSize

	if(packet.packets.current === 0 && packet.ID & 0x80000000){
		packet.bzip = {
			uncompressedSize: reader.long(),
			CRC32_sum: reader.long(),
		};
	}

	packet.payload = reader.remaining();

	return packet;
}
