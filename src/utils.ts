import { promises as dns } from 'dns';
import { isIP } from 'net';

export type ValueIn<T> = T[keyof T];

export class BufferWriter{
	private readonly buffer: number[] = [];

	public string(value: string, encoding: BufferEncoding = 'ascii'): this {
		return this.byte(...Buffer.from(value, encoding), 0);
	}

	public byte(...values: number[]): this {
		this.buffer.push(...values);

		return this;
	}

	public long(number: number): this {
		const buf = Buffer.alloc(4);
		buf.writeInt32LE(number);

		return this.byte(...buf);
	}

	public end(): Buffer {
		return Buffer.from(this.buffer);
	}
}

export class BufferReader{
	constructor(buffer: Buffer, offset = 0){
		this.length = buffer.length;
		this.buffer = buffer;
		this.offset = offset;
	}
	private readonly length: number;
	private readonly buffer: Buffer;
	private offset = 0;

	public byte(): number {
		return this.buffer.readUInt8(this.offset++);
	}

	public short(unsigned = false, endianess: 'BE' | 'LE' = 'LE'): number {
		this.offset += 2;

		return this.buffer[`read${unsigned ? 'U' : ''}Int16${endianess}`](this.offset - 2);
	}

	public long(): number {
		this.offset += 4;
		return this.buffer.readInt32LE(this.offset - 4);
	}

	public float(): number {
		this.offset += 4;
		return this.buffer.readFloatLE(this.offset - 4);
	}

	public bigUInt(): bigint { // long long
		this.offset += 8;
		return this.buffer.readBigUInt64LE(this.offset - 8);
	}

	public string(encoding: BufferEncoding = 'ascii'): string {
		const stringEndIndex = this.buffer.indexOf(0, this.offset);
		if(stringEndIndex === -1) throw new Error('string not terminated');

		const string = this.buffer
			.slice(this.offset, stringEndIndex)
			.toString(encoding);

		this.offset = stringEndIndex + 1;

		return string;
	}

	public char(): string {
		return this.buffer.slice(this.offset++, this.offset).toString();
	}

	public addOffset(offset: number): this {
		this.offset += offset;
		return this;
	}

	public get hasRemaining(): boolean {
		return this.offset < this.length;
	}

	public remaining(): Buffer {
		return this.buffer.slice(this.offset);
	}
}

export function debug(
	string: string,
	thing?: Buffer
): void {
	if(thing){
		const parts = Buffer.from(thing)
			.toString('hex')
			.match(/../g) as string[];

		const str = `<Buffer ${
			thing.length > 300 ?
				`${parts.slice(0, 20).join(' ')} ...${thing.length - 20} bytes` :
				parts.join(' ')
		}>`.replace(/(?<!00 )00 00(?! 00)/g, '\x1B[31m00 00\x1B[00m');

		// eslint-disable-next-line no-console
		console.log(`\x1B[33m${string}\x1B[0m`, str, '\n');
	}else{
		// eslint-disable-next-line no-console
		console.log(`\x1B[33m${string}\x1B[0m`, '\n');
	}
}

export async function resolveHostname(string: string): Promise<{
	ipFormat: 4 | 6;
	ip: string;
}> {
	const ipFormat = isIP(string) as 0 | 4 | 6;
	if(ipFormat !== 0) return {
		ipFormat,
		ip: string,
	};

	try{
		const r = await dns.lookup(string, { verbatim: false });
		if(r.family !== 4 && r.family !== 6){
			throw Error('The IP address is not IPv4 or IPv6');
		}

		return {
			ipFormat: r.family,
			ip: r.address,
		};
	}catch(e){
		throw Error("'ip' is not a valid IP address or hostname");
	}
}