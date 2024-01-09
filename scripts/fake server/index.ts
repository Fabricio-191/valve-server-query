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

		this.ipPort = rinfo.address + ':' + rinfo.port;
		this.ID = this.ipPort + ':' + this.type;
	}
	private readonly socket: Socket;
	private readonly msg: Buffer;
	private readonly rinfo: RemoteInfo;
	public readonly ipPort: string;
	public readonly ID: string;
	public readonly type: ValueIn<typeof Request.requestHeaders>;

	public getChallengeNumber(): number {
		if(this.type === 'A2S_INFO') return this.msg.readUInt32LE(5); // TODO
		return this.msg.readUInt32LE(5);
	}

	public reply(buffer: Buffer): void {
		if(buffer.length > MAX_SINGLE_PACKET_SIZE){
			// TODO: split buffer into multiple packets
		}

		this.socket.send(Buffer.concat([header, buffer]), this.rinfo.port, this.rinfo.address);
	}

	private static requestHeaders = {
		0x54: 'A2S_INFO',
		0x55: 'A2S_PLAYER',
		0x56: 'A2S_RULES',
		0x57: 'A2S_SERVERQUERY_GETCHALLENGE',
		0x69: 'A2S_PING',
	} as const;
}

class FakeServer {
	constructor(port = 0){
		this.socket.on('message', (msg, rinfo) => {
			const request = new Request(msg, rinfo, this.socket);
			this[`handle${request.type}`](request);
		});

		this.socket.bind(port);
	}
	private socket = createSocket('udp4').unref();
	
	public requiresChallenge = true;
	public isGoldSource = false;
	public isTheShip: boolean; 

	public setServerInfo(serverInfo: AnyServerInfo): void {
		this.isTheShip = THE_SHIP_IDS.includes(serverInfo.appID);

		const writer = new BufferWriter();

		if(this.isGoldSource){

		}else{
			writer.byte(0x49); // header
			writer.byte(serverInfo.protocol); // protocol
			writer.string(serverInfo.name);
			writer.string(serverInfo.map);
			writer.string(serverInfo.folder);
			writer.string(serverInfo.game);
			writer.short(serverInfo.ID);
			writer.short(serverInfo.onlinePlayers);
			writer.short(serverInfo.maxPlayers);
			writer.byte(serverInfo.bots);
			writer.byte(serverInfo.protocol);
			writer.byte(serverInfo.OS.charCodeAt(0));
			writer.byte(serverInfo.hasPassword ? 1 : 0);
			writer.byte(serverInfo.VAC ? 1 : 0);
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
			writer.float(player.time);

			if(options.isTheShip){
				writer.long(player.deaths);
				writer.long(player.money);
			}
		}

		this.PLAYER_RESPONSE = writer.end();
	}

	public setRules(rulesObj: Rules): void {
		if(typeof rulesObj !== 'object') throw new TypeError('Rules must be an object');

		const rules = Object.entries(rulesObj);

		const writer = new BufferWriter();
		writer.byte(0x45);
		writer.short(rules.length);

		for(const [key, value] of rules){
			if(typeof key !== 'string') throw new TypeError('Rule key must be a string');
			writer.string(key);
			if(typeof value !== 'string') throw new TypeError('Rule value must be a string');
			writer.string(value);
		}

		this.RULES_RESPONSE = writer.end();
	}

	private readonly challenges = new Map<string, number>();
	handleChallenge(request: Request): boolean {
		if(!this.requiresChallenge) return true;

		const challenge = this.challenges.get(request.ID);
		if(!challenge){
			const challenge = Math.floor(Math.random() * 0xFFFFFFFF);
			this.challenges.set(request.ID, challenge);


		}


	}

	private INFO_RESPONSE: Buffer;
	handleA2S_INFO(request: Request): void {
		if(!this.handleChallenge(request)) return;
		request.reply(this.INFO_RESPONSE);
	}

	private PLAYER_RESPONSE: Buffer;
	handleA2S_PLAYER(request: Request): void {
		if(!this.handleChallenge(request)) return;
		request.reply(this.PLAYER_RESPONSE);
	}

	private RULES_RESPONSE: Buffer;
	handleA2S_RULES(request: Request): void {
		if(!this.handleChallenge(request)) return;
		request.reply(this.RULES_RESPONSE);
	}

	static readonly PING_RESPONSE = Buffer.from('ÿÿÿÿj00000000000000\x00', 'binary');
	static readonly GOLDSOURCE_PING_RESPONSE = Buffer.from('ÿÿÿÿj\x00', 'binary')
	handleA2S_PING(request: Request): void {
		request.reply(
			this.isGoldSource ?
				FakeServer.GOLDSOURCE_PING_RESPONSE :
				FakeServer.PING_RESPONSE
		);
	}

	handleA2S_SERVERQUERY_GETCHALLENGE(request: Request): void {

	}

	public static readonly serverInfo = {
		protocol: 17,
		name: "Fabricio's server",
		map: 'de_dust2',
		folder: 'cstrike',
		game: 'Counter-Strike',
		ID: 0,
		players: 1,
		max_players: 32,
		bots: 4,
		type: 'd',
		OS: 'l',
		hasPassword: false,
		VAC: true,

		// next 3 only in the ship
		mode: 0,
		witnesses: 0,
		duration: 3,

		version: '17.0.0',
		EDF: 0b00000000, // optional ?

		port: 27016,                 				// if EDF & 0b10000000
		steamID: BigInt(1283019239), 				// if EDF & 0b00010000
		TVport: 27020,               				// if EDF & 0b01000000
		TVname: 'SourceTV',          				// if EDF & 0b01000000
		keywords: 'Fabricio,server,Counter-Strike', // if EDF & 0b00100000
		GameId: BigInt(10),                         // if EDF & 0b00000001
	}

	public static readonly playersList = [
		{
			index: 0,
			name: 'Fabricio',
			score: 5,
			time: 12380,
			deaths: 2, // only in the ship
			money: 16000, // only in the ship
		},
		{
			index: 1,
			name: 'Player 1',
			score: 2,
			time: 12380,
			deaths: 1,
			money: 16000,
		},
		{
			index: 2,
			name: 'Player 2',
			score: 2,
			time: 12380,
			deaths: 6,
			money: 16000,
		},
		{
			index: 3,
			name: 'Player 3',
			score: 4,
			time: 12380,
			deaths: 4,
			money: 16000,
		},
		{
			index: 4,
			name: 'Player 4',
			score: 1,
			time: 243,
			deaths: 0,
			money: 16000,
		}
	]

	public static readonly rules = {
		'a': 'b',
		'c': 'd',
		'e': 'f'
	}
}

new FakeServer();