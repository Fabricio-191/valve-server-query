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
		this.buffer = buffer;
		this.offset = offset;
	}
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

	public string(encoding: BufferEncoding = 'utf8'): string {
		const stringEndIndex = this.buffer.indexOf(0, this.offset);
		if(stringEndIndex === -1) throw new Error('string not terminated');

		const string = this.buffer
			.subarray(this.offset, stringEndIndex)
			.toString(encoding);

		this.offset = stringEndIndex + 1;

		return string;
	}

	public char(): string {
		return this.buffer.subarray(this.offset++, this.offset).toString();
	}

	public address(): string {
		return `${this.byte()}.${this.byte()}.${this.byte()}.${this.byte()}:${this.short(true, 'BE')}`;
	}

	public addOffset(offset: number): this {
		this.offset += offset;
		return this;
	}

	public setOffset(offset: number): this {
		if(offset < 0) offset = this.buffer.length + offset;

		this.offset = offset;
		return this;
	}

	public get hasRemaining(): boolean {
		return this.offset < this.buffer.length;
	}

	public get remainingLength(): number {
		return this.buffer.length - this.offset;
	}

	public remaining(): Buffer {
		return this.buffer.subarray(this.offset);
	}

	public checkRemaining(): void {
		if(this.hasRemaining) throw new Error('Buffer has remaining bytes');
	}
}

export function delay(ms: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

export function optionalImport<T>(moduleName: string): T | null {
	try{
		// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
		return require(moduleName) as T;
	}catch{
		return null;
	}
}

export { default as log } from './logger';