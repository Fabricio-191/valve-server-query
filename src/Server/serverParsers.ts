import { BufferReader, type ValueIn } from '../utils';
import type { ServerData } from './options';

// #region constants
const OPERATIVE_SYSTEMS = {
		l: 'linux',
		w: 'windows',
		m: 'mac',
		o: 'mac',
	} as const,
	SERVER_TYPES = {
		d: 'dedicated',
		l: 'non-dedicated',
		p: 'source tv relay',
	} as const,
	THE_SHIP_MODES = [
		'hunt',
		'elimination',
		'duel',
		'deathmatch',
		'vip team',
		'team elimination',
	] as const,
	THE_SHIP_IDS = [
		2400, 2401, 2402, 2403,
		2405, 2406,
		2412, 2430,
	] as const;
// #endregion

export function serverInfo(buffer: Buffer): GoldSourceServerInfo | ServerInfo | TheShipServerInfo {
	const reader = new BufferReader(buffer);

	if(reader.byte() === 0x6D) return goldSourceServerInfo(reader);

	// @ts-expect-error missing properties will be added later
	const info: ServerInfo | TheShipServerInfo = {
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
		type: SERVER_TYPES[reader.char()] as ServerType || null,
		OS: OPERATIVE_SYSTEMS[reader.char()] as OS,
		visibility: reader.byte() ? 'private' : 'public',
		VAC: reader.byte() === 1,
	};

	// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
	if(THE_SHIP_IDS.includes(info.appID)){
		Object.assign(info, {
			mode: THE_SHIP_MODES[reader.byte()],
			witnesses: reader.byte(),
			duration: reader.byte(),
		});
	}

	info.version = reader.string();

	if(!reader.hasRemaining) return info;
	const EDF = reader.byte();

	// 1111 0001
	if(EDF & 0x80) info.port = reader.short(true);
	if(EDF & 0x10) info.steamID = reader.bigUInt();
	if(EDF & 0x40) info.tv = {
		port: reader.short(),
		name: reader.string(),
	};
	if(EDF & 0x20) info.keywords = reader.string().trim().split(',');
	if(EDF & 0x01){
		info.gameID = reader.bigUInt();
		info.appID = Number(info.gameID & 0xFFFFFFn);
	}

	return info;
}

function goldSourceServerInfo(reader: BufferReader): GoldSourceServerInfo {
	const info: GoldSourceServerInfo = {
		address: reader.string(),
		name: reader.string().trim(),
		map: reader.string(),
		folder: reader.string(),
		game: reader.string(),
		players: {
			online: reader.byte(),
			bots: -1,
			max: reader.byte(),
		},
		protocol: reader.byte(),
		goldSource: true,
		type: SERVER_TYPES[
			reader.char().toLowerCase()
		] as ServerType,
		OS: OPERATIVE_SYSTEMS[
			reader.char().toLowerCase()
		] as OS,
		visibility: reader.byte() ? 'private' : 'public',
		mod: reader.byte() ? {
			link: reader.string(),
			downloadLink: reader.string(),
			version: reader.addOffset(1).long(), // null byte
			size: reader.long(),
			multiplayerOnly: reader.byte() === 1,
			ownDLL: reader.byte() === 1,
		} : false,
		VAC: reader.byte() === 1,
	};

	info.players.bots = reader.byte();

	return info;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function parseTime(raw: number){
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

export function players(buffer: Buffer, { appID, enableWarns }: ServerData): Players {
	const reader = new BufferReader(buffer, 1);
	const playerList: Player[] = [];

	// @ts-expect-error https://github.com/microsoft/TypeScript/issues/26255
	if(THE_SHIP_IDS.includes(appID)){
		const playersCount = reader.byte();

		for(let i = 0; i < playersCount; i++){
			playerList.push({
				index: reader.byte(),
				name: reader.string(),
				score: reader.long(),
				timeOnline: parseTime(reader.float()),
			});
		}

		for(const player of playerList){
			Object.assign(player, {
				deaths: reader.long(),
				money: reader.long(),
			});
		}
	}else{
		reader.addOffset(1);

		while(reader.hasRemaining){
			try{
				playerList.push({
					index: reader.byte(),
					name: reader.string(),
					score: reader.long(),
					timeOnline: parseTime(reader.float()),
				});
			}catch{
				// eslint-disable-next-line no-console
				if(enableWarns) console.warn('player info not terminated');
				return playerList.filter(x => x.timeOnline !== null);
			}
		}
	}

	return playerList;
}

export function rules(buffer: Buffer): Rules {
	const reader = new BufferReader(buffer, 1);
	const rulesQty = reader.short(), obj: Rules = {};

	for(let i = 0; i < rulesQty; i++){
		const key = reader.string(), value = reader.string();

		if(value === 'True'){
			obj[key] = true;
		}else if(value === 'False'){
			obj[key] = false;
		// @ts-expect-error using isNaN to check if the string is a number
		}else if(isNaN(value)){
			obj[key] = value;
		}else{
			obj[key] = parseFloat(value);
		}
	}

	return obj;
}

// #region types
type ServerType = ValueIn<typeof SERVER_TYPES>;
type OS = ValueIn<typeof OPERATIVE_SYSTEMS>;

export interface ServerInfo {
	address: string;
	protocol: number;
	goldSource: boolean;
	name: string;
	map: string;
	folder: string;
	game: string;
	appID: number;
	players: {
		online: number;
		max: number;
		bots: number;
	};
	type: ServerType | null;
	OS: OS;
	visibility: 'private' | 'public';
	VAC: boolean;
	// EDF
	version?: string;
	port?: number;
	steamID?: bigint;
	tv?: {
		port: number;
		name: string;
	};
	keywords?: string[];
	gameID?: bigint;
}

export interface TheShipServerInfo extends ServerInfo {
	mode: ValueIn<typeof THE_SHIP_MODES>;
	witnesses: number;
	duration: number;
}

export interface GoldSourceServerInfo {
	address: string;
	name: string;
	map: string;
	folder: string;
	game: string;
	players: {
		online: number;
		max: number;
		bots: number;
	};
	protocol: number;
	goldSource: boolean;
	type: ServerType;
	OS: OS;
	visibility: string;
	mod: false | {
		link: string;
		downloadLink: string;
		version: number;
		size: number;
		multiplayerOnly: boolean;
		ownDLL: boolean;
	};
	VAC: boolean;
}

export type FinalServerInfo = ServerInfo | TheShipServerInfo | GoldSourceServerInfo & (ServerInfo | TheShipServerInfo);

/** Info from a player in the server. */
interface Player {
	/* Index of the player. */
	index: number;
	/** Name of the player. */
	name: string;
	/** Player's score (usually "frags" or "kills"). */
	score: number;
	/** Time in miliseconds that the player has been connected to the server. */
	timeOnline: ReturnType<typeof parseTime>;
}

interface TheShipPlayer extends Player{
	/** Player's deaths (Only for "the ship" servers). */
	deaths: number;
	/** Player's money (Only for "the ship" servers). */
	money: number;
}

export type Players = Player[] | TheShipPlayer[];

/** An object with server's rules */
export interface Rules {
	[key: string]: boolean | number | string;
}
// #endregion
