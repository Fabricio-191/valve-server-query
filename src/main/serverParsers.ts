import { BufferReader } from '../utils/utils';

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


/** An object representing time. */
interface Time {
	hours: number;
	minutes: number;
	seconds: number;

	/** Since when is counting. */
	start: Date;
	/** The number of miliseconds that the player has been connected to the server */
	raw: number;
}

export function time(raw: number | null): Time | null {
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
	};
}

/** An object with the server info */
export interface ServerInfo {
	/** Ip and port from the server */
	address: string;
	/** Response delay from the server (in miliseconds). */
	ping: number;
	/** Protocol version used by the server. */
	protocol: number;
	/** Whether the server uses a goldsource engine. */
	goldSource: boolean;
	/** Name of the server. */
	name: string;
	/** Map the server has currently loaded. */
	map: string;
	/** Name of the folder containing the game files. */
	folder: string;
	/** Full name of the game. */
	game: string;
	/** Steam Application ID of game. */
	appID: bigint | number;

	/** An object with info from the players in the server. */
	players: {
		/** Number of players on the server. */
		online: number;
		/** Maximum number of players the server reports it can hold. */
		max: number;
		/** Number of bots on the server. */
		bots: number;
	};

	/** Indicates the type of server (dedicated, non-dedicated or source tv relay/HLTV) */
	type: 'dedicated' | 'non-dedicated' | 'source tv relay' | null;
	/** Indicates the operating system of the server (windows, linux or mac) */
	OS: 'linux' | 'mac' | 'windows';
	/** Indicates whether the server requires a password */
	visibility: 'private' | 'public';
	/** Specifies whether the server uses VAC */
	VAC: boolean;
	/** If the game hasn't a mod it is `false`, otherwise it's the mod info */
	mod?: Mod | false;

	/**
			 * This field only exist in a response if the server is running The Ship
			 * Indicates the game mode (hunt, elimination, duel, deathmatch, vip team, team elimination)
			*/
	mode?: 'deathmatch' | 'duel' | 'elimination' | 'hunt' | 'team elimination' | 'vip team';
	/**
			 * This field only exist in a response if the server is running The Ship
			 * The number of witnesses necessary to have a player arrested.
			*/
	witnesses?: number;
	/**
			 * This field only exist in a response if the server is running The Ship
			 * Time (in seconds) before a player is arrested while being witnessed.
			*/
	duration?: number;

	/** Version of the game installed on the server. */
	version?: string;

	/** The server's game port number. (provided in the server response) */
	port?: number;
	/** Server's SteamID. */
	steamID?: bigint;

	/** SourceTV data */
	tv?: {
		/** Spectator port number for SourceTV. */
		port: number;
		/** Name of the spectator server for SourceTV. */
		name: string;
	};

	/** Tags that describe the game according to the server. */
	keywords?: string[];

	/** The server's 64-bit GameID. If this is present, the appID is more accurate */
	gameID?: bigint;
}

/** Info from a mod from the game in the server. */
interface Mod {
	/** URL to mod website. */
	link: string;
	/** URL to download the mod. */
	downloadLink: string;
	/** Version of mod installed on server. */
	version: number;
	/** Space (in bytes) the mod takes up. */
	size: number;
	/** Indicates the type if the mod is only for multiplayer or for single and multiplayer*/
	multiplayerOnly: boolean;
	/** Indicates whether mod uses its own DLL or Hald-Life DLL */
	ownDLL: boolean;
}

export function serverInfo(buffer: Buffer): ServerInfo {
	const reader = new BufferReader(buffer);

	if(reader.byte() === 0x6D) return goldSourceServerInfo(reader);

	const info = {
		protocol: reader.byte(),
		goldSource: false,
		name: reader.string().trim(),
		map: reader.string(),
		folder: reader.string(),
		game: reader.string(),
		appID: reader.short(),
		players: {
			online: reader.byte(),
			max: reader.byte(),
			bots: reader.byte(),
		},
		type: SERVER_TYPES[reader.char()] || null,
		OS: OPERATIVE_SYSTEMS[reader.char()],
		visibility: reader.byte() ?
			'private' : 'public',
		VAC: reader.byte() === 1,
	};

	if(THE_SHIP_IDS.includes(info.appID)){
		Object.assign(info, {
			mode: THE_SHIP_MODES[reader.byte()],
			witnesses: reader.byte(),
			duration: reader.byte(),
		});
	}

	info.version = reader.string();

	if(reader.remaining().length === 0) return info;
	const EDF = reader.byte();

	if(EDF & 0x80) info.port = reader.short(true);
	if(EDF & 0x10) info.steamID = reader.bigUInt();
	if(EDF & 0x40) info.tv = {
		port: reader.short(),
		name: reader.string(),
	};
	if(EDF & 0x20) info.keywords = reader.string().trim().split(',');
	if(EDF & 0x01){
		info.gameID = reader.bigUInt();
		info.appID = info.gameID & 0xFFFFFFn;
	}

	return info;
}

export function goldSourceServerInfo(reader: BufferReader): ServerInfo {
	const info = {
		address: reader.string(),
		name: reader.string().trim(),
		map: reader.string(),
		folder: reader.string(),
		game: reader.string(),
		players: {
			online: reader.byte(),
			max: reader.byte(),
		},
		protocol: reader.byte(),
		goldSource: true,
		type: SERVER_TYPES[
			reader.char().toLowerCase()
		],
		OS: OPERATIVE_SYSTEMS[
			reader.char().toLowerCase()
		],
		visibility: reader.byte() ?
			'private' : 'public',
		mod: reader.byte() === 1,
	};

	if(info.mod){
		info.mod = {
			link: reader.string(),
			downloadLink: reader.string(),
		};

		reader.byte(); // null byte

		Object.assign(info.mod, {
			version: reader.long(),
			size: reader.long(),
			multiplayerOnly: Boolean(reader.byte()),
			ownDLL: Boolean(reader.byte()),
		});
	}

	info.VAC = reader.byte() === 1;
	info.players.bots = reader.byte();

	return info;
}

/** Info from a player in the server. */
export interface PlayerInfo {
/* Index of the player. */
	index: number;
	/** Name of the player. */
	name: string;
	/** Player's score (usually "frags" or "kills"). */
	score: number;
	/** Time that the player has been connected to the server. */
	timeOnline: Time | null;

	/** Player's deaths (Only for "the ship" servers). */
	deaths?: number;
	/** Player's money (Only for "the ship" servers). */
	money?: number;
}

export function playersInfo(buffer: Buffer, { appID }: { appID: number }): PlayerInfo[] {
	const reader = new BufferReader(buffer, 1);
	const playersCount = reader.byte(), players = [];

	if(THE_SHIP_IDS.includes(appID)){
		for(let i = 0; i < playersCount; i++){
			players.push({
				index: reader.byte(),
				name: reader.string(),
				score: reader.long(),
				timeOnline: time(reader.float()),
			});
		}

		for(const player of players){
			Object.assign(player, {
				deaths: reader.long(),
				money: reader.long(),
			});
		}
	}else while(reader.remaining().length){
		players.push({
			index: reader.byte(),
			name: reader.string(),
			score: reader.long(),
			timeOnline: time(reader.float()),
		});
	}

	return players;
}

/** An object with server's rules */
export interface Rules {
	[key: string]: boolean | number | string;
}

export function serverRules(buffer: Buffer): Rules {
	const reader = new BufferReader(buffer, 1);
	const rulesQty = reader.short(), rules: Rules = {};

	for(let i = 0; i < rulesQty; i++){
		const key = reader.string(), value = reader.string();

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