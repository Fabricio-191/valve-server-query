import { resolve as resolveDNS } from 'dns';
import { isIP } from 'net';

interface ResolvedIP {
	ip: string;
	format: number;
}

export async function resolveIP(str: string): Promise<ResolvedIP> {
	if(typeof str !== 'string'){
		throw Error("'options.ip' must be a string");
	}else if(isIP(str) === 0){
		const error = new Error('Invalid IP/Hostname');

		[str] = await new Promise((res, rej) => {
			resolveDNS(str, (err, addresses) => {
				if(err !== null || addresses.length === 0){
					return rej(error);
				}

				res(addresses as [string]);
			});
		});
	}

	const ipFormat = isIP(str);
	if(ipFormat === 0){
		throw Error('Invalid IP/Hostname');
	}

	return { ip: str, format: ipFormat };
}

export class BufferWriter{
	private readonly buffer: number[] = [];

	public string(value: string, encoding: BufferEncoding = 'ascii'): this {
		return this.byte(
			...Buffer.from(value, encoding), 0
		);
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
	public offset = 0;

	public byte(): number {
		return this.buffer.readUInt8(this.offset++);
	}

	public short(unsigned = false, endianess: 'BE' | 'LE' = 'LE'): number {
		this.offset += 2;

		return this.buffer[
			`read${unsigned ? 'U' : ''}Int16${endianess}`
		](this.offset - 2);
	}

	public long(): number {
		this.offset += 4;
		return this.buffer.readInt32LE(this.offset - 4);
	}

	public float(): number {
		this.offset += 4;
		return this.buffer.readFloatLE(this.offset - 4);
	}

	public bigUInt(): bigint {// long long
		this.offset += 8;
		return this.buffer.readBigUInt64LE(this.offset - 8);
	}

	public string(encoding: BufferEncoding = 'ascii'): string {
		const stringEndIndex = this.buffer.indexOf(0, this.offset);
		if(stringEndIndex === -1) throw new Error('string not terminated');

		const string = this.buffer.slice(this.offset, stringEndIndex)
			.toString(encoding);

		this.offset = stringEndIndex + 1;

		return string;
	}

	public char(): string {
		return this.buffer.slice(
			this.offset++, this.offset
		).toString();
	}

	public addOffset(offset: number): this {
		this.offset += offset;
		return this;
	}

	public get hasRemaining(): boolean {
		return this.offset === this.length;
	}

	public remaining(): Buffer {
		return this.buffer.slice(this.offset);
	}
}

export type BufferLike = Buffer | number[] | string;

/* eslint-disable no-console */
export function debug(
	type: string,
	string: string,
	thing?: BufferLike
): void {
	string = `\x1B[33m${type} ${string}\x1B[0m`;
	if(thing instanceof Buffer){
		const parts = Buffer.from(thing)
			.toString('hex')
			.match(/../g) as string[];

		for(let i = 0; i < parts.length; i++){
			if(
				parts[i - 1] !== '00' &&
				parts[i + 0] === '00' &&
				parts[i + 1] === '00' &&
				parts[i + 2] !== '00'
			){
				parts[i] = '\x1B[31m00';
				parts[++i] = '00\x1B[0m';
			}
		}

		if(thing.length > 30){
			console.log(string, `<Buffer ${
				parts.slice(0, 20).join(' ')
			} ...${thing.length - 20} bytes>`, '\n');
		}else{
			console.log(string, `<Buffer ${
				parts.join(' ')
			}>`, '\n');
		}
	}else if(typeof thing === 'string'){
		console.log(string, thing, '\n');
	}else{
		console.log(string, '\n');
	}
}
/* eslint-disable no-multiple-empty-lines */