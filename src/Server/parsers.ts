/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { BufferReader, type ValueIn } from '../Base/utils';
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
interface BaseInfo {
	goldSource: boolean;
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
	type: ServerType;
	OS: OS;
	hasPassword: boolean;
	VAC: boolean;
}

export interface GoldSourceServerInfo extends BaseInfo {
	goldSource: true;
	mod: false | {
		link: string;
		downloadLink: string;
		version: number;
		size: number;
		multiplayerOnly: boolean;
		ownDLL: boolean;
	};
}

export interface ServerInfo extends BaseInfo {
	goldSource: false;
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
	wrongEDF?: boolean;
}

export interface TheShipServerInfo extends ServerInfo {
	mode: ValueIn<typeof THE_SHIP_MODES>;
	witnesses: number;
	duration: number;
}

export type AnyServerInfo = GoldSourceServerInfo | ServerInfo | TheShipServerInfo | GoldSourceServerInfo & ServerInfo | GoldSourceServerInfo & TheShipServerInfo;

export interface Player {
	index: number;
	name: string;
	score: number;
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
	partial: boolean;
	list: Player[] | TheShipPlayer[];
}

export interface Rules {
	count: number;
	partial: boolean;
	rules: {
		[key: string]: string;
	};
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

export function serverInfo(buffer: Buffer): GoldSourceServerInfo | ServerInfo | TheShipServerInfo {
	const reader = new BufferReader(buffer);

	if(reader.byte() === 0x6D){
		const info: GoldSourceServerInfo = {
			goldSource: true,
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
			type: serverType(reader.char()),
			OS: operativeSystem(reader.char()),
			hasPassword: reader.byte() === 1,
			mod: false,
			VAC: false,
		};

		// some servers dont have the 'mod' byte
		if(reader.remainingLength > 2 && reader.byte()){
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
		goldSource: false,
		protocol: reader.byte(),
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
		info.wrongEDF = true;
	}

	return info;
}

export function players(buffer: Buffer, svdata: ServerData): Players {
	const reader = new BufferReader(buffer, 1);
	const count = reader.byte();
	const data = {
		count,
		list: [] as Player[],
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

		reader.checkRemaining();
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
				data.partial = true;
				break;
			}
		}
	}

	return data;
}

export function rules(buffer: Buffer): Rules {
	const reader = new BufferReader(buffer, 1);
	const data: Rules = {
		count: reader.short(),
		partial: false,
		rules: {},
	};

	for(let i = 0; i < data.count; i++){
		try{
			const key = reader.string(), value = reader.string();

			data.rules[key] = value;
		}catch{
			data.partial = true;
			break;
		}
	}

	return data;
}
