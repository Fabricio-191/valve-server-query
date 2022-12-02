import { debug, BufferReader } from '../utils';
import { createSocket, type Socket } from 'dgram';

import type { ServerData } from '../options';

// #region packetHandler
function packetHandler(buffer: Buffer, connection: Connection): Buffer | null {
	const header = buffer.readInt32LE();
	if(header === -1){
		return buffer.slice(4);
	}else if(header === -2){
		const packet = handleMultiplePackets(buffer, connection);
		if(packet) return packetHandler(packet, connection);
	}else{
		if(connection.data.debug) debug('SERVER cannot parse multi-packet', buffer);
		if(connection.data.enableWarns){
			// eslint-disable-next-line no-console
			console.error(new Error("Warning: a multi-packet couln't be handled"));
		}
	}

	return null;
}

function handleMultiplePackets(buffer: Buffer, connection: Connection): Buffer | null {
	if(buffer.length > 13 && buffer.readInt32LE(9) === -1){
		// only valid in the first packet
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

export default class Connection {
	constructor(data: ServerData) {
		this.data = data;
		this.socket = createSocket(`udp${this.data.ipFormat}`)
			.on('message', buffer => {
				if(buffer.length === 0) return;

				if(this.data.debug) debug('SERVER recieved:', buffer);

				const packet = packetHandler(buffer, this);
				if(!packet) return;

				this.socket.emit('packet', packet);
			})
			.unref();
	}
	public socket: Socket;
	public readonly packetsQueues: Record<number, [MultiPacket, ...MultiPacket[]]> = {};
	public readonly data: ServerData;

	public connect(): Promise<void> {
		return new Promise((res, rej) => {
			// @ts-expect-error asdasdasd
			this.socket.connect(this.data.port, this.data.ip, (err: unknown) => {
				if(err) return rej(err);
				res();
			});
		});
	}

	public async send(command: Buffer): Promise<void> {
		if(this.data.debug) debug('SERVER sent:', command);

		return new Promise((res, rej) => {
			this.socket.send(
				Buffer.from(command),
				err => {
					if(err) return rej(err);
					res();
				}
			);
		});
	}

	public async awaitResponse(responseHeaders: number[]): Promise<Buffer> {
		return new Promise((res, rej) => {
			const clear = (): void => {
				/* eslint-disable @typescript-eslint/no-use-before-define */
				this.socket.off('packet', onPacket);
				this.socket.off('error', onError);
				clearTimeout(timeout);
				/* eslint-enable @typescript-eslint/no-use-before-define */
			};

			const onError = (err: unknown): void => {
				clear(); rej(err);
			};
			const onPacket = (buffer: Buffer): void => {
				if(!responseHeaders.includes(buffer[0]!)) return;

				clear(); res(buffer);
			};

			const timeout = setTimeout(onError, this.data.timeout, new Error('Response timeout.'));

			this.socket.on('packet', onPacket);
			this.socket.on('error', onError);
		});
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