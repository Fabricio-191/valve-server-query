import { promises as dns } from 'dns';

export async function resolveHostname(string: string): Promise<{
	ipFormat: 4 | 6;
	ip: string;
}> {
	// eslint-disable-next-line @typescript-eslint/init-declarations
	let r;
	try{
		r = await dns.lookup(string, { verbatim: false });
	}catch(e){
		throw Error("'ip' is not a valid IP address or hostname");
	}

	if(r.family !== 4 && r.family !== 6){
		throw Error('');
	}

	return {
		ipFormat: r.family,
		ip: r.address,
	};
}

export type NonEmptyArray<T> = [T, ...T[]];
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

	public address(endianess: 'BE' | 'LE'): string {
		return `${this.byte()}.${this.byte()}.${this.byte()}.${this.byte()}:${this.short(true, endianess)}`;
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
	buffer?: Buffer | string
): void {
	if(buffer){
		const parts = Buffer.from(buffer)
			.toString('hex')
			.match(/../g) as string[];

		const str = `<Buffer ${
			buffer.length > 300 ?
				`${parts.slice(0, 20).join(' ')} ...${buffer.length - 20} bytes` :
				parts.join(' ')
		}>`.replace(/(?<!00 )00 00(?! 00)/g, '\x1B[31m00 00\x1B[00m');

		// eslint-disable-next-line no-console
		console.log(`\x1B[33m${string}\x1B[0m`, str, '\n');
	}else{
		// eslint-disable-next-line no-console
		console.log(`\x1B[33m${string}\x1B[0m`, '\n');
	}
}

export class DeferredPromise<T> {
	constructor(executor?: (resolve: (value: PromiseLike<T> | T) => void, reject: (reason?: unknown) => void) => void){
		this.promise = new Promise<T>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			if(executor) executor(resolve, reject);
		});

		this.then = this.promise.then.bind(this.promise);
		this.catch = this.promise.catch.bind(this.promise);
		this.finally = this.promise.finally.bind(this.promise);
	}
	public promise: Promise<T>;
	public resolve!: (value: PromiseLike<T> | T) => void;
	public reject!: (reason?: unknown) => void;
	public then;
	public catch;
	public finally;
}

export function delay(ms: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}
