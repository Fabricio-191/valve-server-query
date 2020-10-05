const constants = require('./constants.json');

function time(total){
	if(!total || total === -1) return null;

	const hours   = Math.floor(total/ 3600);
	const minutes = Math.floor(total/ 60) -hours*60;
	const seconds = Math.floor(total) -minutes*60 -hours*3600;

	return { 
		hours, 
		minutes, 
		seconds,
		start: new Date(Date.now() - total),
		raw: total
	};
}

class BufferParser{
	constructor(buffer, offset = 0){
		Object.assign(this, { buffer, offset });
	}
	buffer = null;
	offset = 0;

	byte(){
		return this.buffer.readUInt8(this.offset++);
	}

	uShort(BE = false){
		this.offset += 2;
		if(BE){
			return this.buffer.readUInt16BE(this.offset-2);
		}
		return this.buffer.readUInt16LE(this.offset-2);
	}

	short(){
		this.offset += 2;
		return this.buffer.readInt16LE(this.offset-2);
	}

	long(){
		this.offset += 4;
		return this.buffer.readInt32LE(this.offset-4);
	}
	
	float(){
		this.offset += 4;
		return this.buffer.readFloatLE(this.offset-4);
	}

	bigUInt(){//long long
		this.offset += 8;
		return this.buffer.readBigUInt64LE(this.offset-8);
	}

	string(){
		let stringEndIndex = this.buffer.indexOf(0, this.offset);
		let string = this.buffer.slice(this.offset, stringEndIndex).toString(); 
			
		this.offset += (stringEndIndex - this.offset) + 1;
		return string;
	}

	char(){
		return this.buffer.slice(
			this.offset++, this.offset
		).toString();
	}


	remaining(){
		return this.buffer.slice(this.offset);
	}
}

module.exports = {
	BufferParser,
	serverInfo, playersInfo,
	serverRules, serverList,
	multiPacketResponse
};

function serverInfo(buffer){
	buffer = new BufferParser(buffer);

	if(buffer.byte() === 0x6D){ //is goldsource
		return goldSourceServerInfo(buffer);
	}
	
	let	info = {
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
			bots: buffer.byte()
		},
		type: constants.SERVER_TYPES[buffer.char()] || null,
		OS: constants.OPERATIVE_SYSTEMS[buffer.char()],
		visibility: buffer.byte()?'private':'public',
		VAC: buffer.byte() === 1
	};

	if(info.game === 'The Ship'){
		Object.assign(info, {
			mode: constants.THE_SHIP_MODES[buffer.byte()],
			witnesses: buffer.byte(),
			duration: buffer.byte(),
		});
	}

	info.version = buffer.string();
		
	if(buffer.remaining().length === 0) return info;
	const EDF = buffer.byte();
		
	if (EDF & 0x80) {//1000 0000
		info.port = buffer.uShort(); 
	}
	if (EDF & 0x10) {//0001 0000
		info.steamID = buffer.bigUInt();
	}
	if (EDF & 0x40) {//0100 0000
		info['tv-port'] = buffer.short();
		info['tv-name'] = buffer.string();
	}
	if (EDF & 0x20) {//0010 0000
		info.keywords = buffer.string().trim().split(',');
	}
	if (EDF & 0x01) {//0000 0001
		info.gameID = buffer.bigUInt(); //00000000 00000000 00000000 00000000 
		info.appID = info.gameID & 0xFFFFFFn;
	}
	
	return info;
}

function goldSourceServerInfo(buffer){
	let info = {
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

		type: constants.SERVER_TYPES[
			buffer.char().toLowerCase()
		],
		OS: constants.OPERATIVE_SYSTEMS[
			buffer.char().toLowerCase()
		],
		visibility: buffer.byte()?'private':'public',
		mod: buffer.byte() === 1
	};

	if(info.mod){
		info.modInfo = {
			link: buffer.string(),
			downloadLink: buffer.string(),
			
		};

		buffer.byte(); //null byte

		Object.assign(info.modInfo, {
			version: buffer.long(),
			size: buffer.long(),
			type: buffer.byte()?'multiplayer only mod':'single and multiplayer mod',
			DLL: buffer.byte()?'it uses its own DLL':'it uses the Half-Life DLL'
		});
	}
	
	info.VAC = buffer.byte() === 1;
	info.players.bots = buffer.byte();

	return info;
}

function playersInfo(buffer){
	buffer = new BufferParser(buffer, 1);
	//first byte = header
	const playersCount = buffer.byte(), players = [];
	for (let i = 0; i < playersCount; i++) {
		//'bSlf'
		
		players.push({ 
			index: buffer.byte(), 
			name: buffer.string(), 
			score: buffer.long(), 
			timeOnline: time(buffer.float())
		});
	}
	
	
	if(buffer.remaining().length){
		if(
			playersCount !== 255 && 
			buffer.remaining().length === (playersCount * 8)
		){
			for (let i = 0; i < playersCount; i++) { //is the ship
				Object.assign(players[i], { 
					deaths: buffer.long(), 
					money: buffer.long()
				});
			}
		}else{
			while(buffer.remaining().length){
				players.push({ 
					index: buffer.byte(), 
					name: buffer.string(), 
					score: buffer.long(), 
					timeOnline: time(buffer.float())
				});
			}
		}
	}
	
	return players;
}

function serverRules(buffer){
	buffer = new BufferParser(buffer, 1);
	//firstByte = header
	const rulesQuantity = buffer.short(), rules = {};
	
	for(let i=0; i < rulesQuantity; i++){
		const key = buffer.string(), value = buffer.string();

		if(value === ''){
			rules[key] = value;
		}else if(!isNaN(value)){
			rules[key] = Number(value);
		}else{
			let b = value.toLowerCase().trim();
			if(['true', 'false'].includes(b)){
				rules[key] = (b === 'true');
			}else{
				rules[key] = value;
			}
		}
	}
	
	return rules;
}

function multiPacketResponse(buffer, server){
	buffer = new BufferParser(buffer, 4);

	const ID = buffer.long(), packets = buffer.byte();

	if(server._info[1]){
		return {
			ID, 
			packets: {
				current: (packets & 0xF0) >> 4,
				total: packets & 0x0F
			},
			payload: buffer.remaining(),
			goldSource: true,
			raw: buffer.buffer
		};
	}else{
		const info = { 
			ID, 
			packets: {
				total: packets,
				current: buffer.byte()
			},
			goldSource: false,
			raw: buffer.buffer
		};

		if(
			!constants.APPS_IDS.PACKET_SIZE.includes(server.appID) && 
			!(server.protocol === 7 && server.appID === 240)
		){
			info.maxPacketSize = buffer.short();
		}
		
		if(info.packets.current === 0 && (info.ID & 0x80000000)){ //10000000 00000000 00000000 00000000
			info.bzip = { 
				uncompressedSize: buffer.long(), 
				CRC32_sum: buffer.long() 
			};
		}

		info.payload = buffer.remaining();

		return info;
	}
}

function serverList(buffer){
	buffer = new BufferParser(buffer, 2);
	let servers = [];

	while (buffer.remaining().length) {
		let ip = [
			buffer.byte(),
			buffer.byte(),
			buffer.byte(),
			buffer.byte()
		].join('.');
		
		servers.push(ip+':'+buffer.uShort(true));
	}

	return servers;
}