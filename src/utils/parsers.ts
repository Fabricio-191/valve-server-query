/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable no-bitwise */
const OPERATIVE_SYSTEMS = {
		l: 'linux',
		w: 'windows',
		m: 'mac',
		o: 'mac',
	},
	SERVER_TYPES = {
		d: 'dedicated',
		l: 'non-dedicated',
		p: 'source tv relay',
	},
	THE_SHIP_MODES = [
		'hunt',
		'elimination',
		'duel',
		'deathmatch',
		'vip team',
		'team elimination',
	],
	THE_SHIP_IDS = [
		2400, 2401, 2402, 2403, 2405, 2406,
		2412, 2430,
	];

export function time(raw: number | null){
	if(!raw || raw === -1) return null;

	const hours = Math.floor(raw / 3600)								|| 0;
	const minutes = Math.floor(raw / 60) - hours * 60					|| 0;
	const seconds = Math.floor(raw)		 - hours * 3600 - minutes * 60	|| 0;

	return {
		hours,
		minutes,
		seconds,
		raw,
		start: new Date(Date.now() - raw),
		toString(){
			return [this.hours, this.minutes, this.seconds]
				.reduce((acc, value) => {
					if(acc !== ''){
						// @ts-expect-error
						if(value < 10) value = '0' + value;
						acc += ':' + value;
					}else if(value !== 0) acc += value;

					return acc;
				}, '');
		},
	};
}

export class BufferParser{
	constructor(buffer: Buffer, offset = 0){
		this.raw = buffer;
		this.offset = offset;
	}
	private readonly raw: Buffer;
	private offset = 0;

	public byte(): number {
		return this.raw.readUInt8(this.offset++);
	}

	public short(unsigned = false, endianess = 'LE'): number {
		this.offset += 2;

		return this.raw[
			`read${unsigned ? 'U' : ''}Int16${endianess}`
		](this.offset - 2) as number;
	}

	public long(): number {
		this.offset += 4;
		return this.raw.readInt32LE(this.offset - 4);
	}

	public float(): number {
		this.offset += 4;
		return this.raw.readFloatLE(this.offset - 4);
	}

	public bigUInt(): bigint {// long long
		this.offset += 8;
		return this.raw.readBigUInt64LE(this.offset - 8);
	}

	public string(encoding: BufferEncoding = 'ascii'): string {
		const stringEndIndex = this.raw.indexOf(0, this.offset);
		if(stringEndIndex === -1) throw new Error('string not terminated');

		const string = this.raw.slice(this.offset, stringEndIndex)
			.toString(encoding);

		this.offset = stringEndIndex + 1;

		return string;
	}

	public char(): string {
		return this.raw.slice(
			this.offset++, this.offset
		).toString();
	}

	public remaining(): Buffer {
		return this.raw.slice(this.offset);
	}
}

export function serverInfo(raw: Buffer){
	const buffer = new BufferParser(raw);

	if(buffer.byte() === 0x6D) return goldSourceServerInfo(buffer);

	const info = {
		protocol: buffer.byte(),
		goldSource: false,
		name: buffer.string().trim(),
		map: buffer.string(),
		folder: buffer.string(),
		game: buffer.string(),
		appID: buffer.short(),
		players: {
			online: buffer.byte(),
			max: buffer.byte(),
			bots: buffer.byte(),
		},
		type: SERVER_TYPES[buffer.char()] || null,
		OS: OPERATIVE_SYSTEMS[buffer.char()],
		visibility: buffer.byte() ?
			'private' : 'public',
		VAC: buffer.byte() === 1,
	};

	if(THE_SHIP_IDS.includes(info.appID)){
		Object.assign(info, {
			mode: THE_SHIP_MODES[buffer.byte()],
			witnesses: buffer.byte(),
			duration: buffer.byte(),
		});
	}

	info.version = buffer.string();

	if(buffer.remaining().length === 0) return info;
	const EDF = buffer.byte();

	if(EDF & 0x80) info.port = buffer.short(true);
	if(EDF & 0x10) info.steamID = buffer.bigUInt();
	if(EDF & 0x40) info.tv = {
		port: buffer.short(),
		name: buffer.string(),
	};
	if(EDF & 0x20) info.keywords = buffer.string().trim().split(',');
	if(EDF & 0x01){
		info.gameID = buffer.bigUInt();
		info.appID = info.gameID & 0xFFFFFFn;
	}

	return info;
}

export function goldSourceServerInfo(buffer: BufferParser){
	const info = {
		address: buffer.string(),
		name: buffer.string().trim(),
		map: buffer.string(),
		folder: buffer.string(),
		game: buffer.string(),
		players: {
			online: buffer.byte(),
			max: buffer.byte(),
		},
		protocol: buffer.byte(),
		goldSource: true,
		type: SERVER_TYPES[
			buffer.char().toLowerCase()
		],
		OS: OPERATIVE_SYSTEMS[
			buffer.char().toLowerCase()
		],
		visibility: buffer.byte() ?
			'private' : 'public',
		mod: buffer.byte() === 1,
	};

	if(info.mod){
		// @ts-expect-error
		info.mod = {
			link: buffer.string(),
			downloadLink: buffer.string(),
		};

		buffer.byte(); // null byte

		Object.assign(info.mod, {
			version: buffer.long(),
			size: buffer.long(),
			multiplayerOnly: Boolean(buffer.byte()),
			ownDLL: Boolean(buffer.byte()),
		});
	}

	info.VAC = buffer.byte() === 1;
	info.players.bots = buffer.byte();

	return info;
}

export function playersInfo(raw: Buffer, { appID }: { appID: number }){
	const buffer = new BufferParser(raw, 1);
	const playersCount = buffer.byte(), players = [];

	if(THE_SHIP_IDS.includes(appID)){
		for(let i = 0; i < playersCount; i++){
			players.push({
				index: buffer.byte(),
				name: buffer.string(),
				score: buffer.long(),
				timeOnline: time(buffer.float()),
			});
		}

		for(const player of players){
			Object.assign(player, {
				deaths: buffer.long(),
				money: buffer.long(),
			});
		}
	}else while(buffer.remaining().length){
		players.push({
			index: buffer.byte(),
			name: buffer.string(),
			score: buffer.long(),
			timeOnline: time(buffer.float()),
		});
	}

	return players;
}

export function serverRules(raw: Buffer): Promise<Record<string, boolean | number | string>> {
	const buffer = new BufferParser(raw, 1);
	const rulesQty = buffer.short(), rules = {};

	for(let i = 0; i < rulesQty; i++){
		const key = buffer.string(), value = buffer.string();

		if(value === 'True'){
			rules[key] = true;
		}else if(value === 'False'){
			rules[key] = false;
		// @ts-expect-error using isNaN to check if the string is a number
		}else if(isNaN(value)){
			rules[key] = value;
		}else{
			rules[key] = parseFloat(value);
		}
	}

	return rules;
}

const MPS_IDS = [ 215, 17550, 17700 ];
export function multiPacketResponse(raw: Buffer, _meta){
	const buffer = new BufferParser(raw, 4);
	const ID = buffer.long(), packets = buffer.byte();

	if(_meta.multiPacketResponseIsGoldSource){
		return {
			ID,
			packets: {
				current: (packets & 0xF0) >> 4,
				total: packets & 0x0F,
			},
			payload: buffer.remaining(),
			goldSource: true,
			raw: buffer.raw,
		};
	}
	const info = {
		ID,
		packets: {
			total: packets,
			current: buffer.byte(),
		},
		goldSource: false,
		raw: buffer.raw,
	};

	if(
		!MPS_IDS.includes(_meta.appID) &&
		!(_meta.appID === 240 && _meta.protocol === 7)
	){
		info.maxPacketSize = buffer.short();
	}

	if(info.packets.current === 0 && info.ID & 0x80000000){ // 10000000 00000000 00000000 00000000
		info.bzip = {
			uncompressedSize: buffer.long(),
			CRC32_sum: buffer.long(),
		};
	}

	info.payload = buffer.remaining();

	return info;
}

export function serverList(raw: Buffer){
	const buffer = new BufferParser(raw, 2);
	const servers = [];

	while(buffer.remaining().length){
		const ip = [
			buffer.byte(),
			buffer.byte(),
			buffer.byte(),
			buffer.byte(),
		].join('.');

		servers.push(ip + ':' + buffer.short(true, 'BE'));
	}

	return servers;
}

export function RCONPacket(raw: Buffer){
	const buffer = new BufferParser(raw);

	return {
		size: buffer.long(),
		ID: buffer.long(),
		type: buffer.long(),
		body: buffer.string(),
	};
	// there is an extra null byte that doesn't matter
}