const constants = require('./constants.json');

function time(total){
	if(!total || total === -1) return null;

	const hours   = Math.floor(total/ 3600)
	const minutes = Math.floor(total/ 60) -hours*60
	const seconds = Math.floor(total) -minutes*60 -hours*3600
	
	const start = Date.now() - total;

	return { 
		hours, 
		minutes, 
		seconds,
		start: new Date(start)
	};
}

class BufferParser{
	constructor(buffer, offset = 0){
		Object.assign(this, { buffer, offset })
	}
	buffer = null;
	offset = 0;

	byte(){
		return this.buffer.readUInt8(this.offset++);
	}

	uShort(){
		this.offset += 2;
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
		let string = this.buffer.slice(this.offset, stringEndIndex).toString() 
		
		this.offset += Buffer.byteLength(string) + 1;
		return string;
	}

	char(){
		return this.buffer.slice(
			this.offset++, this.offset
		).toString()
	}


	remaining(){
		return this.buffer.slice(this.offset)
	}
}

module.exports = {
	serverInfo: buffer => {
		//'bbSSSSsbbbccbb'
		buffer = new BufferParser(buffer, 1)

		const info = {
			//header: first byte,
			protocol: buffer.byte(),
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
			type: constants.serversTypes[buffer.char()] || null,
			OS: constants.operativeSystems[buffer.char()],
			visibility: buffer.byte()?'private':'public',
			VAC: buffer.byte() === 1
		};

		if(info.game === 'The Ship'){
			Object.assign(info, {
				mode: constants.theShipModes[buffer.byte()],
				witnesses: buffer.byte(),
				duration: buffer.byte(),
			})
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
			info.gameID = buffer.bigUInt();
			info.appID = info.gameID & BigInt(0xFFFFFF)
		}
		return info;
	},
	goldSourceServerInfo: buffer => {
		buffer = new BufferParser(buffer, 1)
		//'bSSSSSbbbccbb'
		
		const info = {
			//header: first byte,
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

			type: constants.serversTypes[
				buffer.char().toLowerCase()
			],
			OS: constants.operativeSystems[
				buffer.char().toLowerCase()
			],
			visibility: buffer.byte()?'private':'public',
			mod: buffer.byte() === 1
		};

		if(info.mod){
			//'SSbllbb'
			info.modInfo = {
				link: buffer.string(),
				downloadLink: buffer.string(),
				
			}

			buffer.byte(); //null byte

			Object.assign(info.modInfo, {
				version: buffer.long(),
				size: buffer.long(),
				type: buffer.byte()?'multiplayer only mod':'single and multiplayer mod',
				DLL: buffer.byte()?'it uses its own DLL':'it uses the Half-Life DLL'
			})
		}

		
		info.VAC = buffer.byte() === 1;
		info.players.bots = buffer.byte();

		return info;
	},

	playersInfo: buffer => {
		buffer = new BufferParser(buffer, 1)
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
		
		if(buffer.remaining().length){ //is the ship (there is more bytes in the buffer)
			for (let i = 0; i < playersCount; i++) {
				Object.assign(players[i], { 
					deaths: buffer.int(4), 
					money: buffer.int(4)
				});
			}
		}
		
		return players;
	},
	serverRules: buffer => {
		buffer = new BufferParser(buffer, 1)
		//firstByte = header
		const rulesQuantity = buffer.short(), rules = {};
		
		for(let i=0; i < rulesQuantity; i++){
			const key = buffer.string(), value = buffer.string();

			if((!isNaN(value) && value !== '') || value === '0'){ //numbers in strings
				rules[key] = parseInt(value);
			}else if(['true', 'false'].includes( //booleans in strings
				value.toLowerCase().trim()
			)){
				rules[key] = (value.toLowerCase().trim() === 'true');
			}else{
				rules[key] = value;
			}
		}
		
		return rules;
	},

	multiPacketResponse: (buffer, server) => {
		buffer = new BufferParser(buffer)

		if(server.isGoldSource){
			const ID = buffer.long(), packets = buffer.byte();

			return {
				ID, 
				packets: {
					current: (packets & 0b11110000) >> 4,
					total: packets & 0b00001111
				},
				payload: buffer.remaining()
			};
		}else{
			const info = { 
				ID: buffer.long(), 
				packets: {
					total: buffer.byte(),
					current: buffer.byte()
				}
			};

			if(
				!constants.apps_IDs.packetSize.includes(server.appID) && 
				!(server.protocol === 7 && server.appID === 240)
			){
				info.maxPacketSize = buffer.short();
			}
			
			if(info.packets.current === 0 && info.id.toString(2)[0] === 1){ //10000000 00000000 00000000 00000000
				info.bzip = { 
					uncompressedSize: buffer.long(), 
					CRC32_sum: buffer.long() 
				};
			}
	
			info.payload = buffer.remaining();
	
			return info;
		}
	}
}