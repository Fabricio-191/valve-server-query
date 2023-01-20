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

const BZIP_START = Buffer.from('BZh'); // 42 5a 68
const HEADER1 = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
const PLAYERS_AND_RULES_HEADERS = Object.freeze([ 0x44, 0x45 ]);

type PacketData = {
	goldSource?: true;
	hasSize?: true;
	bzip?: true;
	hasHeader?: true;
	totalPackets: number;
} | null;

function getMultiPacketData(buffer: Buffer, ID: number): PacketData { // works for first packet only
	if(equals(buffer, HEADER1, 9)){
		const packets = buffer.readUInt8(8);
		if(packets >> 4 !== 0) return null;

		return { goldSource: true, totalPackets: packets & 0x0F };
	}

	const currentPacket = buffer.readUInt8(9);
	if(currentPacket !== 0) return null;
	const totalPackets = buffer.readUInt8(8);

	if(ID & 0x80000000){
		if(equals(buffer, BZIP_START, 18)) return { totalPackets, bzip: true };
		if(equals(buffer, BZIP_START, 20)) return { totalPackets, bzip: true, hasSize: true };
	}else{
		if(equals(buffer, HEADER1, 10)) return { totalPackets, hasHeader: true };
		if(equals(buffer, HEADER1, 12)) return { totalPackets, hasHeader: true, hasSize: true };
		// some servers dont have the header in the payload
		if(PLAYERS_AND_RULES_HEADERS.includes(buffer[10]!)) return { totalPackets };
		if(PLAYERS_AND_RULES_HEADERS.includes(buffer[12]!)) return { totalPackets, hasSize: true };
	}

	return null;
}

export class Connection extends BaseConnection<ServerData> {
	private readonly packetsQueues = new Map<number, {
		list: Buffer[];
		data: PacketData;
	}>();

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			if(buffer[4] === 0x6C){
				const reason = buffer.toString('utf8', 5, buffer.length - 1);
				const error = Object.assign(
					new Error('Banned by server'), {
						reason, rawMessage: buffer,
						ip: this.data.ip,
						port: this.data.port,
					}
				);

				if(this.socket.listenerCount('error') !== 0) this.socket.emit('error', error);
			}else{
				this.socket.emit('packet', buffer.subarray(4));
			}
		}else if(header === -2){
			this.handleMultiplePackets(buffer);
		}else{
			debug(this.data, 'ERROR cannot parse packet', buffer);
		}
	}

	protected handleMultiplePackets(buffer: Buffer): void {
		const packetID = buffer.readUInt32LE(4);

		if(!this.packetsQueues.has(packetID)){
			this.packetsQueues.set(packetID, { list: [], data: null });

			setTimeout(() => {
				if(this.packetsQueues.has(packetID)){
					const queue = this.packetsQueues.get(packetID)!;

					debug(this.data, 'ERROR multi packet not recieved completely', buffer.subarray(4, 8));
					debug(this.data, JSON.stringify(queue, null, '  '));
					this.packetsQueues.delete(packetID);
				}
			}, this.data.timeout).unref();
		}

		const queue = this.packetsQueues.get(packetID)!;
		queue.list.push(buffer);

		const mpData = getMultiPacketData(buffer, packetID);
		if(mpData){
			if(queue.data){
				debug(this.data, 'ERROR multiple packets with different types');
				throw new Error('Multiple packets with different types');
			}else{
				queue.data = mpData;
			}
		}

		if(queue.data && queue.list.length === queue.data.totalPackets){
			const packets = queue.list.map(p => parsePacket(p, queue.data!));

			let payload = Buffer.concat(
				packets.sort((p1, p2) => p1.currentPacket - p2.currentPacket)
					.map(p => p.payload)
			);

			if('bzip' in packets[0]!){
				if(!seekBzip) throw new Error('optional dependency "seek-bzip" needed');

				payload = seekBzip.decode(payload, packets[0].bzip.uncompressedSize);
			}

			if(payload.readInt32LE() === -1){
				payload = payload.subarray(4);
			}

			this.socket.emit('packet', payload);
			this.packetsQueues.delete(packetID);
		}
		// const hasSizeField = this.data.protocol !== 7 || !MPS_IDS.includes(this.data.appID);
	}

	public async makeQuery(command: (key?: Buffer) => Buffer, responseHeaders: readonly number[]): Promise<Buffer> {
		let buffer = await this.query(command(), responseHeaders);
		let attempt = 0;

		while(buffer[0] === 0x41 && attempt < 15){
			buffer = await this.query(command(buffer.subarray(1)), responseHeaders);
			attempt++;
		}

		if(buffer[0] === 0x41) throw new Error('Wrong server response');

		return buffer;
	}
}

export default async function createConnection(options: RawServerOptions): Promise<Connection> {
	const connection = new Connection(parseServerOptions(options));
	await connection.connect();
	return connection;
}

interface GldSrcMultiPacket {
	currentPacket: number;
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

function parsePacket(buffer: Buffer, data: Exclude<PacketData, null>): GldSrcMultiPacket | SourceMultiPacket {
	const reader = new BufferReader(buffer, 8);

	if(data.goldSource) return {
		currentPacket: reader.byte() >> 4,
		payload: reader.remaining(),
	};

	// @ts-expect-error payload is added later
	const packet: SourceMultiPacket = {
		currentPacket: reader.addOffset(1).byte(),
		raw: buffer,
	};

	if(data.hasSize) reader.addOffset(2);

	if(packet.currentPacket === 0 && data.bzip){
		packet.bzip = {
			uncompressedSize: reader.long(),
			CRC32_sum: reader.long(),
		};
	}

	packet.payload = reader.remaining();

	return packet;
}
