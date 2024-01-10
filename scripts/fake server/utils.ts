export type ValueIn<T> = T[keyof T]

export const THE_SHIP_MODES = [
	'hunt',
	'elimination',
	'duel',
	'deathmatch',
	'vip team',
	'team elimination',
] as const;




export const THE_SHIP_IDS = Object.freeze([
	2400, 2401, 2402, 2403,
	2405, 2406,
	2412, 2430,
]);

type OS = 'l' | 'm' | 'w';
type ServerType = 'd' | 'l' | 'p';

interface BaseInfo {
	address: string;
	name: string;
	map: string;
	folder: string;
	game: string;
	onlinePlayers: number;
	maxPlayers: number;
	bots: number;
	protocol: number;
	type: ServerType;
	OS: OS;
	hasPassword: boolean;
	VAC: boolean;
}

interface GoldSourceServerInfo extends BaseInfo {
	mod: false | {
		link: string;
		downloadLink: string;
		version: number;
		size: number;
		multiplayerOnly: boolean;
		ownDLL: boolean;
	};
}

interface ServerInfo extends BaseInfo {
	appID: number;
	EDF?: number;
	version?: string;
	gamePort?: number;
	steamID?: bigint;
	TVport?: number;
	TVname?: string;
	keywords?: string;
	gameID?: bigint;
}

interface TheShipServerInfo extends ServerInfo {
	mode: 'hunt' | 'elimination' | 'duel' | 'deathmatch' | 'vip team' | 'team elimination';
	witnesses: number;
	duration: number;
}

export type AnyServerInfo = GoldSourceServerInfo | ServerInfo | TheShipServerInfo | GoldSourceServerInfo & ServerInfo | GoldSourceServerInfo & TheShipServerInfo;

interface Player {
	index: number;
	name: string;
	score: number;
	timeOnline: number;
}

interface TheShipPlayer extends Player{
	deaths: number;
	money: number;
}

export type Players = Player[] | TheShipPlayer[];

export interface Rules {
	[key: string]: string;
}

export class BufferWriter{
	private readonly buffer: number[] = [];

	public string(value: string, encoding: BufferEncoding = 'ascii'): this {
		if(typeof value !== 'string') throw new TypeError('value must be a string');

		return this.byte(...Buffer.from(value, encoding), 0);
	}

	public byte(...values: number[]): this {
		for(const value of values){
			if(typeof value !== 'number') throw new TypeError('value must be a number');
			if(value < 0 || value > 0xFF) throw new RangeError('value must be between 0 and 255');
		}

		this.buffer.push(...values);
		return this;
	}

	public short(number: number, unsigned = false, endianess: 'BE' | 'LE' = 'LE'): this {
		if(typeof number !== 'number') throw new TypeError('value must be a number');

		const buf = Buffer.alloc(2);
		buf[`write${unsigned ? 'U' : ''}Int16${endianess}`](number);

		return this.byte(...buf);
	}

	public long(number: number): this {
		if(typeof number !== 'number') throw new TypeError('value must be a number');

		const buf = Buffer.alloc(4);
		buf.writeInt32LE(number);

		return this.byte(...buf);
	}

	public float(number: number): this {
		if(typeof number !== 'number') throw new TypeError('value must be a number');

		const buf = Buffer.alloc(4);
		buf.writeFloatLE(number);

		return this.byte(...buf);
	}

	public bigUInt(number: bigint): this {
		if(typeof number !== 'bigint') throw new TypeError('value must be a bigint');

		const buf = Buffer.alloc(8);
		buf.writeBigUInt64LE(number);

		return this.byte(...buf);
	}

	public end(): Buffer {
		return Buffer.from(this.buffer);
	}
}
