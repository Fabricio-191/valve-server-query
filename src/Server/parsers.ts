/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { BufferReader, type ValueIn } from '../Base/utils';

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
	_wrongData?: boolean;
	address: string;
	name: string;
	map: string;
	folder: string;
	game: string;
	players: {
		online: number;
		max: number;
		bots: number | 'unknown';
	};
	protocol: number;
	type: ServerType;
	OS: OS;
	hasPassword: boolean;
	VAC: boolean | 'unknown';
}

export interface GoldSourceServerInfo extends BaseInfo {
	mod: boolean | 'unknown' | {
		link: string;
		downloadLink: string;
		version: number;
		size: number;
		multiplayerOnly: boolean;
		ownDLL: boolean;
	};
}

export interface ServerInfo extends BaseInfo {
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
}

export interface TheShipServerInfo extends ServerInfo {
	_isTheShip: true;
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
		case 'd': return 'dedicated'; // 64 44
		case 'l': return 'non-dedicated'; // 6c 4c
		case 'p': return 'source tv relay'; // 70 50
		case '\x00': return 'unknown';
		default: throw new Error(`Unknown server type: ${type}`);
	}
}

type OS = 'linux' | 'mac' | 'unknown' | 'windows';
function operativeSystem(OS: string): OS {
	switch(OS.toLowerCase()){
		case 'l': return 'linux'; // 6c 4c
		case 'w': return 'windows'; // 77 57
		case 'm': // 6d 4d
		case 'o': return 'mac'; // 6f 4f
		case '\x00': return 'unknown';
		default: throw new Error(`Unknown operative system: ${OS}`);
	}
}

class Time {
	constructor(raw: number){
		this.raw = raw;
		this.start = new Date(Date.now() - raw);
		this.hours = Math.floor(this.raw / 3600)		|| 0;
		this.minutes = Math.floor(this.raw / 60) % 60	|| 0;
		this.seconds = Math.floor(this.raw % 60) 		|| 0;
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
			address: reader.string(), // 31 32 37 2e 30 2e 30 2e 31 3a 2d 32 30 38 33 31 37 34 39 36 00
			name: reader.string().trim(), // 47 47 2e 4f 4c 44 53 2e 52 4f 20 23 20 32 30 30 38 00
			map: reader.string(), // 67 67 5f 66 72 65 61 6b 00
			folder: reader.string(), // 63 73 74 72 69 6b 65 00
			game: reader.string(), // 43 6f 75 6e 74 65 72 2d 53 74 72 69 6b 65 00
			players: {
				online: reader.byte(),
				bots: 'unknown',
				max: reader.byte(),
			},
			protocol: reader.byte(),
			type: serverType(reader.char()),
			OS: operativeSystem(reader.char()),
			hasPassword: reader.byte() === 1,
			mod: false,
			VAC: false,
		};

		if(reader.remainingLength === 3){
			info.mod = reader.byte() === 1;
			if(info.mod) info._wrongData = true;

			info.VAC = reader.byte() === 1;
			info.players.bots = reader.byte();
		}else if(reader.remainingLength >= 16){ // has mod
			info.mod = {
				link: reader.string(),
				downloadLink: reader.string(),
				version: reader.addOffset(1).long(),
				size: reader.long(),
				multiplayerOnly: reader.byte() === 1,
				ownDLL: reader.byte() === 1,
			};

			info.VAC = reader.byte() === 1;
			if(reader.hasRemaining) info.players.bots = reader.byte();
		}else{
			info.mod = 'unknown';
			info._wrongData = true;

			reader.setOffset(-2);
			info.VAC = reader.byte() === 1;
			info.players.bots = reader.byte();
		}

		return info;
	}

	// @ts-expect-error missing properties are added later
	const info: ServerInfo | TheShipServerInfo = {
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
			_isTheShip: true,
			mode: THE_SHIP_MODES[reader.byte()],
			witnesses: reader.byte(),
			duration: reader.byte(),
		});
	}

	info.version = reader.string();


	if(!reader.hasRemaining) return info;
	const EDF = reader.byte();

	try{
		if(EDF & 0b10000000) info.gamePort = reader.short(true);
		if(EDF & 0b00010000) info.steamID = reader.bigUInt();
		if(EDF & 0b01000000) info.tv = {
			port: reader.short(),
			name: reader.string(),
		};
		if(EDF & 0b00100000) info.keywords = reader.string().trim().split(',');
		if(EDF & 0b00000001){
			info.gameID = reader.bigUInt();
			info.appID = Number(info.gameID & BigInt(0xFFFFFF));
		}

		reader.checkRemaining();
	}catch{
		if(EDF & 0b10000000) delete info.gamePort;
		if(EDF & 0b00010000) delete info.steamID;
		if(EDF & 0b01000000) delete info.tv;
		if(EDF & 0b00100000) delete info.keywords;
		if(EDF & 0b00000001) delete info.gameID;
		info._wrongData = true;
	}

	return info;
}

export function players(buffer: Buffer, isTheShip: boolean): Players {
	const reader = new BufferReader(buffer, 1);
	const count = reader.byte();
	const data = {
		count,
		list: [] as Player[],
		partial: false,
	};

	if(isTheShip){
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
			data.rules[reader.string()] = reader.string();
		}catch{
			data.partial = true;
			break;
		}
	}

	return data;
}
