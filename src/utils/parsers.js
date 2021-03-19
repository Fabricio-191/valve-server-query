/* eslint-disable no-multi-spaces */
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
	];

class Time{
	constructor(raw){
		const hours   = Math.floor(raw / 3600) 							|| 0;
		const minutes = Math.floor(raw / 60) - hours * 60 				|| 0;
		const seconds = Math.floor(raw) - minutes * 60 - hours * 3600 	|| 0;

		Object.assign(this, {
			hours, minutes, seconds, raw,
			start: new Date(Date.now() - raw),
		});
	}

	hours = 0;
	minutes = 0;
	seconds = 0;
	start = null;
	raw = 0;

	toString(){
		return [this.hours, this.minutes, this.seconds]
			.reduce((acc, value) => {
				if(acc !== ''){
					// @ts-ignore
					if(value < 10) value = '0' + value;
					acc += ':' + value;
				}
				else if(value !== 0){ acc += value; }


				return acc;
			}, '');
	}

	[Symbol.toPrimitive](hint){
		if(hint === 'number'){
			return this.raw;
		}else if(hint === 'string'){
			return this.toString();
		}

		return true;
	}
}

function time(value){
	if(!value || value === -1) return null;

	return new Time(value);
}

class BufferParser{
	constructor(buffer, offset = 0){
		Object.assign(this, { raw: buffer, offset });
	}
	raw = null;
	offset = 0;

	byte(){
		return this.raw.readUInt8(this.offset++);
	}

	short(unsigned = false, endianess = 'LE'){
		this.offset += 2;
		if(unsigned){
			return this.raw[`readUInt16${endianess}`](this.offset-2);
		}

		return this.raw[`readInt16${endianess}`](this.offset-2);
	}

	long(){
		this.offset += 4;
		return this.raw.readInt32LE(this.offset-4);
	}

	float(){
		this.offset += 4;
		return this.raw.readFloatLE(this.offset-4);
	}

	bigUInt(){// long long
		this.offset += 8;
		return this.raw.readBigUInt64LE(this.offset-8);
	}

	string(){
		const stringEndIndex = this.raw.indexOf(0, this.offset);
		const string = this.raw.slice(this.offset, stringEndIndex).toString();

		this.offset += stringEndIndex - this.offset + 1;
		return string;
	}

	char(){
		return this.raw.slice(
			this.offset++, this.offset,
		).toString();
	}


	remaining(){
		return this.raw.slice(this.offset);
	}
}

module.exports = {
	BufferParser,
	serverInfo, playersInfo,
	serverRules, serverList,
	multiPacketResponse,

	RCONPacket,
};

function serverInfo(buffer){
	buffer = new BufferParser(buffer);

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

	if(info.game === 'The Ship' || info.appID === 2400){
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

function goldSourceServerInfo(buffer){
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
		// @ts-ignore
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

function playersInfo(buffer){
	buffer = new BufferParser(buffer, 1);

	const playersCount = buffer.byte(), players = [];
	for(let i = 0; i < playersCount; i++){
		players.push({
			index: buffer.byte(),
			name: buffer.string(),
			score: buffer.long(),
			timeOnline: time(buffer.float()),
		});
	}

	const remaining = buffer.remaining();
	if(remaining.length){
		if(
			playersCount !== 255 &&
			remaining.length === playersCount * 8
		){ // is the ship
			for(let i = 0; i < playersCount; i++){
				Object.assign(players[i], {
					deaths: buffer.long(),
					money: buffer.long(),
				});
			}
		}else{
			while(buffer.remaining().length){
				players.push({
					index: buffer.byte(),
					name: buffer.string(),
					score: buffer.long(),
					timeOnline: time(buffer.float()),
				});
			}
		}
	}

	return players;
}

function serverRules(buffer){
	buffer = new BufferParser(buffer, 1);
	const rulesQuantity = buffer.short(), rules = {};

	for(let i=0; i < rulesQuantity; i++){
		const key = buffer.string(), value = buffer.string();

		if(value === ''){
			rules[key] = value;
		}else if(isNaN(value)){
			const b = value.toLowerCase().trim();
			if(['true', 'false'].includes(b)){
				rules[key] = b === 'true';
			}else{
				rules[key] = value;
			}
		}else{
			rules[key] = Number(value);
		}
	}

	return rules;
}

function multiPacketResponse(buffer, _meta){
	buffer = new BufferParser(buffer, 4);
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
		![ 215, 17550, 17700 ].includes(_meta.appID) &&
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

function serverList(buffer){
	buffer = new BufferParser(buffer, 2);
	const servers = [];

	while(buffer.remaining().length){
		const ip = [
			buffer.byte(),
			buffer.byte(),
			buffer.byte(),
			buffer.byte(),
		].join('.');

		servers.push(ip+':'+buffer.short(true, 'BE'));
	}

	return servers;
}

function RCONPacket(raw){
	const buffer = new BufferParser(raw);

	return {
		size: buffer.long(),
		ID: buffer.long(),
		type: buffer.long(),
		body: buffer.remaining(),
		raw,
	};
}