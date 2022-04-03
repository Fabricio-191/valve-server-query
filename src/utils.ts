import { promises as dnsPromises, type RecordWithTtl } from 'dns';
import { isIP } from 'net';

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


export interface BaseOptions {
	ip: string;
	port: number;
	timeout: number;
	debug: boolean;
	enableWarns: boolean;
}

export type ValueIn<T> = T[keyof T];
export type UnknownValues<T> = {
	[P in keyof T]: unknown;
};

export async function checkBaseOptions(options: UnknownValues<BaseOptions>): Promise<void> {
	if(typeof options !== 'object' || options === null){
		throw Error("'options' must be an object");
	}

	if(
		typeof options.port !== 'number' || isNaN(options.port) ||
		options.port < 0 || options.port > 65535
	){
		throw Error('The port to connect should be a number between 0 and 65535');
	}else if(typeof options.debug !== 'boolean'){
		throw Error("'debug' should be a boolean");
	}else if(typeof options.enableWarns !== 'boolean'){
		throw Error("'enableWarns' should be a boolean");
		// @ts-expect-error using isNaN to check if the value is a number
	}else if(isNaN(options.timeout) || options.timeout < 0){
		throw Error("'timeout' should be a number greater than zero");
	}else if(typeof options.ip !== 'string'){
		throw Error("'ip' should be a string");
	}else if(isIP(options.ip) === 0){
		options.ip = await resolveHostname(options.ip);
	}
}

async function resolveHostname(str: string): Promise<string> {
	const addresses = await dnsPromises.resolveAny(str);
	const ip = addresses.find(x => x.type === 'A' || x.type === 'AAAA') as RecordWithTtl || null;

	if(ip === null){
		throw Error('Invalid IP/Hostname');
	}

	if(isIP(ip.address) === 6){
		// eslint-disable-next-line no-console
		console.error('IPv6 is not supported but i could do it if someone ask me to.');
		throw Error('IPv6 is not supported');
	}

	return ip.address;
}


/* eslint-disable no-console */
export function debug(
	string: string,
	thing?: BufferLike
): void {
	string = `\x1B[33m${string}\x1B[0m`;
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
