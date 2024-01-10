import { createSocket, type RemoteInfo, type Socket } from 'dgram';
import { BufferWriter, THE_SHIP_IDS, THE_SHIP_MODES } from './utils';
import type { ValueIn, AnyServerInfo, Players, Rules } from './utils';

const header = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
const MAX_SINGLE_PACKET_SIZE = 300; // Usually it's 1400, but i can use less for testing purposes

class Request {
	constructor(msg: Buffer, rinfo: RemoteInfo, socket: Socket){
		this.socket = socket;
		this.msg = msg;
		this.rinfo = rinfo;

		if(msg.subarray(0, 4).compare(header) !== 0) throw new Error('Wrong request header');

		this.type = Request.requestHeaders[msg[4] as keyof typeof Request.requestHeaders];

		if(!this.type) throw new Error(`Unknown request header: ${msg[4]?.toString(16)}`);

		this.ID = rinfo.address + ':' + rinfo.port + ':' + this.type;
	}
	private readonly socket: Socket;
	private readonly msg: Buffer;
	private readonly rinfo: RemoteInfo;
	public readonly ID: string;
	public readonly type: ValueIn<typeof Request.requestHeaders>;

	public getChallengeNumber(): number {
		if(this.type === 'A2S_INFO') return this.msg.readUInt32LE(5); // TODO
		return this.msg.readUInt32LE(5);
	}

	public reply(buffer: Buffer): void {
		if(buffer.length <= MAX_SINGLE_PACKET_SIZE){
			this.socket.send(Buffer.concat([header, buffer]), this.rinfo.port, this.rinfo.address);
			return;
		}

		// TODO: split buffer into multiple packets
	}

	private static requestHeaders = {
		0x54: 'A2S_INFO',
		0x55: 'A2S_PLAYER',
		0x56: 'A2S_RULES',
		0x57: 'A2S_SERVERQUERY_GETCHALLENGE',
		0x69: 'A2S_PING',
	} as const;
}

export default class FakeServer {
	constructor(
		port = 0,
		serverInfo: AnyServerInfo,
		playersList: Players,
		rules: Rules
	){
		this.setServerInfo(serverInfo);
		this.setPlayersList(playersList);
		this.setRules(rules);

		this.socket.on('message', (msg, rinfo) => {
			const request = new Request(msg, rinfo, this.socket);
			this[`handle${request.type}`](request);
		});

		this.socket.bind(port);
	}
	private socket = createSocket('udp4').unref();

	public stop(): void {
		this.socket.close();
	}
	
	public requiresChallenge!: boolean;
	public oldChallengeSystem!: boolean;
	public goldsourcePing = false;
	public isTheShip!: boolean;
	public showEmptyEDF!: boolean;

	public setServerInfo(serverInfo: AnyServerInfo): void {
		// goldsource keys = ['protocol', 'name', 'map', 'folder', 'game', 'appID', 'onlinePlayers', 'maxPlayers', 'bots', 'type', 'OS', 'hasPassword', 'VAC', 'mod', 'address']
		// source keys = ['protocol', 'name', 'map', 'folder', 'game', 'ID', 'onlinePlayers', 'maxPlayers', 'bots', 'protocol', 'OS', 'hasPassword', 'VAC', 'version', 'EDF']
		// extra keys = ['gamePort', 'steamID', 'TVport', 'TVname', 'keywords', 'gameID']
		// the ship keys = [...source keys, 'mode', 'witnesses', 'duration']

		const writer = new BufferWriter();

		if('mod' in serverInfo){
			writer.byte(0x49); // header
			writer.byte(serverInfo.protocol); // protocol
			writer.string(serverInfo.name);
			writer.string(serverInfo.map);
			writer.string(serverInfo.folder);
			writer.string(serverInfo.game);
			writer.byte(serverInfo.onlinePlayers);
			writer.byte(serverInfo.bots);
			writer.byte(serverInfo.maxPlayers);
			writer.byte(serverInfo.type.charCodeAt(0));
			writer.byte(serverInfo.OS.charCodeAt(0));
			writer.byte(serverInfo.hasPassword ? 1 : 0);
			writer.byte(serverInfo.VAC ? 1 : 0);

			if(typeof serverInfo.mod === 'object'){
				writer.byte(1);
				writer.string(serverInfo.mod.link);
				writer.string(serverInfo.mod.downloadLink);
				writer.long(serverInfo.mod.version);
				writer.long(serverInfo.mod.size);
				writer.byte(serverInfo.mod.multiplayerOnly ? 1 : 0);
				writer.byte(serverInfo.mod.ownDLL ? 1 : 0);
			}else{
				writer.byte(0);
			}

			writer.byte(serverInfo.bots);
		}else{
			writer.byte(0x49); // header
			writer.byte(serverInfo.protocol); // protocol
			writer.string(serverInfo.name);
			writer.string(serverInfo.map);
			writer.string(serverInfo.folder);
			writer.string(serverInfo.game);
			writer.short(serverInfo.appID);
			writer.short(serverInfo.onlinePlayers);
			writer.short(serverInfo.maxPlayers);
			writer.byte(serverInfo.bots);
			writer.byte(serverInfo.protocol);
			writer.byte(serverInfo.OS.charCodeAt(0));
			writer.byte(serverInfo.hasPassword ? 1 : 0);
			writer.byte(serverInfo.VAC ? 1 : 0);

			if('witnesses' in serverInfo){
				this.isTheShip = true;
				writer.byte(THE_SHIP_MODES.indexOf(serverInfo.mode));
				writer.byte(serverInfo.witnesses);
				writer.byte(serverInfo.duration);
			}

			writer.string(serverInfo.version!);
			if('EDF' in serverInfo && serverInfo.EDF !== 0){
				writer.byte(serverInfo.EDF);
				if(serverInfo.EDF & 0b10000000) writer.short(serverInfo.gamePort!);
				if(serverInfo.EDF & 0b00010000) writer.bigUInt(serverInfo.steamID!);
				if(serverInfo.EDF & 0b01000000){
					writer.short(serverInfo.TVport!);
					writer.string(serverInfo.TVname!);
				}
				if(serverInfo.EDF & 0b00100000) writer.string(serverInfo.keywords!);
				if(serverInfo.EDF & 0b00000001) writer.bigUInt(serverInfo.gameID!);
			}else if(this.showEmptyEDF){
				writer.byte(0);
			}
		}

		this.INFO_RESPONSE = writer.end();
	}

	public setPlayersList(playersList: Players): void {
		if(!Array.isArray(playersList)) throw new TypeError('Players list must be an array');

		const writer = new BufferWriter();
		writer.byte(0x44);
		writer.byte(playersList.length > 255 ? 255 : playersList.length);

		for(const player of playersList){
			writer.byte(player.index);
			writer.string(player.name);
			writer.long(player.score);
			writer.float(player.timeOnline);

			if(this.isTheShip){
				// @ts-expect-error buffer writer will throw an error if the value is not present
				writer.long(player.deaths);
				// @ts-expect-error buffer writer will throw an error if the value is not present
				writer.long(player.money);
			}
		}

		this.PLAYER_RESPONSE = writer.end();
		/*
		const size = playersList.reduce((acc, player) => acc + player.name.length + 1, 0) + playersList.length * 9 + (this.isTheShip ? playersList.length * 8 : 0) + 2;
		const buffer = Buffer.allocUnsafe(size);

		buffer[0] = 0x44;
		buffer[1] = playersList.length > 255 ? 255 : playersList.length;

		let offset = 2;
		for(const player of playersList){
			buffer[offset++] = player.index;
			offset += buffer.write(player.name, offset);

			buffer.writeUInt32LE(player.score, offset);
			offset += 4;
			buffer.writeFloatLE(player.timeOnline, offset);
			offset += 4;

			if(this.isTheShip){
				buffer.writeUInt32LE(player.deaths, offset);
				offset += 4;
				buffer.writeUInt32LE(player.money, offset);
				offset += 4;
			}
		}
		*/
	}

	public setRules(rulesObj: Rules): void {
		if(typeof rulesObj !== 'object') throw new TypeError('Rules must be an object');

		const rules = Object.entries(rulesObj);

		const writer = new BufferWriter();
		writer.byte(0x45);
		writer.short(rules.length);

		for(const [key, value] of rules){
			writer.string(key);
			writer.string(value);
		}

		this.RULES_RESPONSE = writer.end();

		/*
		const size = rules.reduce((acc, [key, value]) => acc + key.length + value.length + 2, 0) + 3;
		const buffer = Buffer.allocUnsafe(size);

		buffer[0] = 0x45;
		buffer.writeUInt16LE(rules.length, 1);

		let offset = 3;
		for(const [key, value] of rules){
			buffer.write(key, offset);
			offset += key.length + 1;
			buffer.write(value, offset);
			offset += value.length + 1;
		}

		this.RULES_RESPONSE = buffer;
		*/
	}

	private INFO_RESPONSE!: Buffer;
	private PLAYER_RESPONSE!: Buffer;
	private RULES_RESPONSE!: Buffer;
	static readonly PING_RESPONSE = Buffer.from('ÿÿÿÿj00000000000000\x00', 'binary');
	static readonly GOLDSOURCE_PING_RESPONSE = Buffer.from('ÿÿÿÿj\x00', 'binary')

	public handleA2S_INFO(request: Request): void {
		if(!this.handleChallenge(request)) return;
		request.reply(this.INFO_RESPONSE);
	}

	public handleA2S_PLAYER(request: Request): void {
		if(!this.handleChallenge(request)) return;
		request.reply(this.PLAYER_RESPONSE);
	}

	public handleA2S_RULES(request: Request): void {
		if(!this.handleChallenge(request)) return;
		request.reply(this.RULES_RESPONSE);
	}

	public handleA2S_PING(request: Request): void {
		request.reply(
			this.goldsourcePing ?
				FakeServer.GOLDSOURCE_PING_RESPONSE :
				FakeServer.PING_RESPONSE
		);
	}

	public handleA2S_SERVERQUERY_GETCHALLENGE(request: Request): void {
		const number = Math.floor(Math.random() * 0xFFFFFFFF);

		const buffer = new BufferWriter()
			.byte(0x41)
			.long(number)
			.end();

		// TODO

		request.reply(buffer);
	}

	private readonly challenges = new Map<string, number>();
	public handleChallenge(request: Request): boolean {
		if(!this.requiresChallenge) return true;

		const challenge = this.challenges.get(request.ID);
		if(!challenge){
			const challenge = Math.floor(Math.random() * 0xFFFFFFFF);
			this.challenges.set(request.ID, challenge);

			const buffer = new BufferWriter()
				.byte(0x41)
				.long(challenge)
				.end();

			request.reply(buffer);
			
			return false;
		}

		if(challenge !== request.getChallengeNumber()) return false;

		return true;
	}
}



const serverInfo = {
	protocol: 17,
	name: "Fabricio's server",
	map: 'de_dust2',
	folder: 'cstrike',
	game: 'Counter-Strike',
	appID: 0,
	onlinePlayers: 1,
	maxPlayers: 32,
	bots: 4,
	type: 'd',
	OS: 'l',
	hasPassword: false,
	VAC: true,

	// next 3 only in the ship
	mode: 0,
	witnesses: 0,
	duration: 3,

	// next 2 only in goldsource
	mod: false,
	address: 'asdasdasd',

	// next only in source
	version: '17.0.0',
	EDF: 0b00000000, // optional ?

	gamePort: 27016,                 				// if EDF & 0b10000000
	steamID: BigInt(1283019239), 				// if EDF & 0b00010000
	TVport: 27020,               				// if EDF & 0b01000000
	TVname: 'SourceTV',          				// if EDF & 0b01000000
	keywords: 'Fabricio,server,Counter-Strike', // if EDF & 0b00100000
	gameID: BigInt(10),                         // if EDF & 0b00000001
}

const playersList = [
	{
		index: 0,
		name: 'Fabricio',
		score: 5,
		timeOnline: 12380,
		deaths: 2, // only in the ship
		money: 16000, // only in the ship
	},
	{
		index: 1,
		name: 'Player 1',
		score: 2,
		timeOnline: 12380,
		deaths: 1,
		money: 16000,
	},
	{
		index: 2,
		name: 'Player 2',
		score: 2,
		timeOnline: 12380,
		deaths: 6,
		money: 16000,
	},
	{
		index: 3,
		name: 'Player 3',
		score: 4,
		timeOnline: 12380,
		deaths: 4,
		money: 16000,
	},
	{
		index: 4,
		name: 'Player 4',
		score: 1,
		timeOnline: 243,
		deaths: 0,
		money: 16000,
	}
]

const rules = {
	'a': 'b',
	'c': 'd',
	'e': 'f'
}

const server = new FakeServer(27015, serverInfo, playersList, rules);

setTimeout(() => {
	server.stop();
}, 1000 * 60 * 5);