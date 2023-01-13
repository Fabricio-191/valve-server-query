/* eslint-disable no-console, no-multi-spaces */
const bzipStart = Buffer.from('BZh'); // 42 5a 68
const header1 = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
const header2 = Buffer.from([0xFE, 0xFF, 0xFF, 0xFF]);

function equals(buf1: Buffer, buf2: Buffer, start: number): boolean {
	const end = start + buf2.length;
	if(buf1.length < end) return false;

	return buf2.compare(buf1, start, end) === 0;
}

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

const ID = Buffer.from([0x33, 0x33, 0x33, 0x33]);
const sizeField = Buffer.from([0xEE, 0xEE]);
const BzipID = Buffer.from([0x80, 0x80, 0x80, 0x80]);
const bzipData = Buffer.from([0xCC, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC]);
const data =     Buffer.from([0xBB, 0xBB, 0xBB, 0xBB, 0xBB, 0xBB, 0xBB, 0xBB]);

const packets = [
	Buffer.from([ ...header2, ...ID,     2,                  ...header1,                ...data ]),
	Buffer.from([ ...header2, ...ID,     2, 0, ...sizeField, ...header1,                ...data ]),
	Buffer.from([ ...header2, ...ID,     2, 0,               ...header1,                ...data ]),
	Buffer.from([ ...header2, ...BzipID, 2, 0, ...sizeField, ...bzipData, ...bzipStart, ...data ]),
	Buffer.from([ ...header2, ...BzipID, 2, 0,               ...bzipData, ...bzipStart, ...data ]),
];

for(const packet of packets){
	console.log(getMultiPacketType(packet, packet.readUInt32BE(4)));
}

