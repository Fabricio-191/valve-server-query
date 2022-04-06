import { promises as dnsPromises } from 'dns';
import type { AnyARecord, AnyAaaaRecord } from 'dns';
import { isIP } from 'net';

export type ValueIn<T> = T[keyof T];

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
	string = `\x1B[33m${string}\x1B[0m`;
	if(thing instanceof Buffer){
		const parts = Buffer.from(thing)
			.toString('hex')
			.match(/../g) as string[];

		const str = `<Buffer ${
			thing.length > 30 ?
				`${parts.slice(0, 20).join(' ')} ...${thing.length - 20} bytes` :
				parts.join(' ')
		}>`.replace(/(?<!00 )00 00(?! 00)/g, '\x1B[31m00 00\x1B[00m');

		// eslint-disable-next-line no-console
		console.log(string, str, '\n');
	}else{
		// eslint-disable-next-line no-console
		console.log(string, '\n');
	}
}


export interface RawOptions {
	ip?: string;
	port?: number;
	timeout?: number;
	debug?: boolean;
	enableWarns?: boolean;
}
export interface Options extends Required<RawOptions> {
	ipFormat: 4 | 6;
}

const DEFAULT_OPTIONS: Required<RawOptions> = {
	ip: 'localhost',
	port: 27015,
	timeout: 5000,
	debug: false,
	enableWarns: true,
} as const;

const recordTypes = ['A', 'AAAA'] as const;
export async function parseOptions(options: unknown, defaultOptions = DEFAULT_OPTIONS): Promise<Options> {
	if(typeof options !== 'object' || options === null){
		throw Error("'options' must be an object");
	}

	// @ts-expect-error ipFormat is added later
	const opts: Options = {
		...defaultOptions,
		...options,
	};

	if(
		typeof opts.port !== 'number' || isNaN(opts.port) ||
		opts.port < 0 || opts.port > 65535
	){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof opts.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof opts.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
	}else if(typeof opts.timeout !== 'number' || isNaN(opts.timeout) || opts.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}else if(typeof opts.ip !== 'string'){
		throw Error("'ip' should be a string");
	}

	const ipFormat = isIP(opts.ip) as 0 | 4 | 6;
	if(ipFormat === 0){
		const addresses = await dnsPromises.resolveAny(opts.ip);
		const record = addresses.find(x =>
			// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
			recordTypes.includes(x.type)
		) as AnyAaaaRecord | AnyARecord;

		if(typeof record === 'undefined'){
			throw Error('Invalid IP/Hostname');
		}

		opts.ip = record.address;
		opts.ipFormat = record.type === 'A' ? 4 : 6;
	}else opts.ipFormat = ipFormat;

	return opts;
}
/* eslint-disable no-multiple-empty-lines */