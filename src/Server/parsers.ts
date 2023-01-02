/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { BufferReader, type ValueIn, debug } from '../Base/utils';
import type { ServerData } from '../Base/options';

const THE_SHIP_MODES = Object.freeze([
		'hunt',
		'elimination',
		'duel',
		'deathmatch',
		'vip team',
		'team elimination',
	]),
	THE_SHIP_IDS = Object.freeze([
		2400, 2401, 2402, 2403,
		2405, 2406,
		2412, 2430,
	]);

// #region types
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
	hasPassword: boolean;
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

export type ServerInfo = Omit<GoldSourceServerInfo, 'mod'> & {
	appID: number;
	version?: string;
	gamePort?: number;
	steamID?: bigint;
	tv?: {
		port: number;
		name: string;
	};
	keywords?: string[];
	gameID?: bigint;
};

export interface TheShipServerInfo extends ServerInfo {
	mode: ValueIn<typeof THE_SHIP_MODES>;
	witnesses: number;
	duration: number;
}

export type AnyServerInfo = GoldSourceServerInfo | ServerInfo | TheShipServerInfo | GoldSourceServerInfo & (ServerInfo | TheShipServerInfo);

export interface Player {
	/* Index of the player. */
	index: number;
	/** Name of the player. */
	name: string;
	/** Player's score (usually "frags" or "kills"). */
	score: number;
	/** Time in miliseconds that the player has been connected to the server. */
	timeOnline: Time;
}

export interface TheShipPlayer extends Player{
	/** Player's deaths (Only for "the ship" servers). */
	deaths: number;
	/** Player's money (Only for "the ship" servers). */
	money: number;
}

export interface Players {
	count: number;
	list: Player[] | TheShipPlayer[];
	partial: boolean;
}

export interface Rules {
	[key: string]: boolean | number | string;
}
// #endregion

type ServerType = 'dedicated' | 'non-dedicated' | 'source tv relay' | 'unknown';
function serverType(type: string): ServerType {
	switch(type.toLowerCase()){
		case 'd': return 'dedicated';
		case 'l': return 'non-dedicated';
		case 'p': return 'source tv relay';
		case '\x00': return 'unknown';
		default: throw new Error(`Unknown server type: ${type}`);
	}
}

type OS = 'linux' | 'mac' | 'unknown' | 'windows';
function operativeSystem(OS: string): OS {
	switch(OS.toLowerCase()){
		case 'l': return 'linux';
		case 'w': return 'windows';
		case 'm':
		case 'o': return 'mac';
		case '\x00': return 'unknown';
		default: throw new Error(`Unknown operative system: ${OS}`);
	}
}

export function serverInfo(buffer: Buffer, data: ServerData): GoldSourceServerInfo | ServerInfo | TheShipServerInfo {
	const reader = new BufferReader(buffer);

	if(reader.byte() === 0x6D){
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
			type: serverType(reader.char()),
			OS: operativeSystem(reader.char()),
			hasPassword: reader.byte() === 1,
			mod: false,
			VAC: false,
		};

		// some servers dont have the 'mod' byte
		if(reader.remaining().length > 2 && reader.byte()){
			info.mod = {
				link: reader.string(),
				downloadLink: reader.string(),
				version: reader.addOffset(1).long(), // null byte
				size: reader.long(),
				multiplayerOnly: reader.byte() === 1,
				ownDLL: reader.byte() === 1,
			};
		}

		info.VAC = reader.byte() === 1;
		if(reader.hasRemaining) info.players.bots = reader.byte();

		reader.checkRemaining();
		return info;
	}

	// @ts-expect-error missing properties are added later
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
		type: serverType(reader.char()),
		OS: operativeSystem(reader.char()),
		hasPassword: reader.byte() === 1,
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

	if(!reader.hasRemaining) return info;
	const EDF = reader.byte();

	try{ // some servers have a bad implementation of EDF
		if(EDF & 0b10000000) info.gamePort = reader.short(true);
		if(EDF & 0b00010000) info.steamID = reader.bigUInt();
		if(EDF & 0b01000000) info.tv = {
			port: reader.short(),
			name: reader.string(),
		};
		if(EDF & 0b00100000) info.keywords = reader.string().trim().split(',');
		if(EDF & 0b00000001){
			info.gameID = reader.bigUInt();
			info.appID = Number(info.gameID & 0xFFFFFFn);
		}

		reader.checkRemaining();
	}catch{
		// eslint-disable-next-line no-console
		if(data.enableWarns) console.warn('Wrong EDF');
		debug(data, 'Wrong EDF');
	}

	return info;
}

class Time {
	constructor(raw: number){
		this.raw = raw;
		this.start = new Date(Date.now() - raw);
		this.hours = Math.floor(this.raw / 3600)		|| 0;
		this.minutes = Math.floor(this.raw / 60) % 60 	|| 0;
		this.seconds = this.raw % 60 					|| 0;
	}
	public raw: number;
	public start: Date;
	public hours: number;
	public minutes: number;
	public seconds: number;

	public toString(){
		if(this.hours) return `${this.hours}h ${this.minutes}m ${this.seconds}s`;
		if(this.minutes) return `${this.minutes}m ${this.seconds}s`;
		return `${this.seconds}s`;
	}
}

export function players(buffer: Buffer, svdata: ServerData): Players {
	const reader = new BufferReader(buffer, 1);
	const count = reader.byte();
	const data: {
		count: number;
		list: Player[];
		partial: boolean;
	} = {
		count,
		list: [],
		partial: false,
	};

	if(THE_SHIP_IDS.includes(svdata.appID)){
		while(reader.remainingLength !== data.list.length * 8){
			data.list.push({
				index: reader.byte(),
				name: reader.string(),
				score: reader.long(),
				timeOnline: new Time(reader.float()),
			});
		}

		for(const player of data.list){
			Object.assign(player, {
				deaths: reader.long(),
				money: reader.long(),
			});
		}
	}else{
		while(reader.hasRemaining){
			try{
				data.list.push({
					index: reader.byte(),
					name: reader.string(),
					score: reader.long(),
					timeOnline: new Time(reader.float()),
				});
			}catch{
				debug(svdata, 'player info not terminated');
				data.partial = true;
			}
		}
	}

	return data;
}

export function rules(buffer: Buffer, data: ServerData): Rules {
	const reader = new BufferReader(buffer, 1);
	const rulesQty = reader.short(), obj: Rules = {};

	for(let i = 0; i < rulesQty; i++){
		try{
			const key = reader.string(), value = reader.string();

			if(value === 'True'){
				obj[key] = true;
			}else if(value === 'False'){
				obj[key] = false;
			}else{
				try{
					obj[key] = Number(value);
				}catch{
					obj[key] = value;
				}
			}
		}catch{
			// eslint-disable-next-line no-console
			if(data.enableWarns) console.warn('rules not terminated');
			debug(data, 'rules not terminated');
			return obj;
		}
	}

	return obj;
}
