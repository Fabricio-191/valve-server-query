import { EventEmitter } from 'events';
import type Server from './server';
import type { FinalServerInfo as ServerInfo, Players, Rules } from './parsers';

type InfoKeys = [keyof ServerInfo, ...Array<keyof ServerInfo>];
type Player = Players['list'][number];

const queries = ['info', 'players', 'rules'] as const;

interface Options {
	watch: Array<'info' | 'players' | 'rules'>;
	interval: number;
}
type RawOptions = Partial<Options>;

export const DEFAULT_OPTIONS: Options = {
	watch: ['info', 'players'],
	interval: 30000,
};

function parseOptions(options: RawOptions, previousOptions: Options): Options {
	const data: Options = {
		...previousOptions,
		...options,
	};

	if(!Array.isArray(data.watch)){
		throw new Error('The watch option must be an array.');
	}else if(data.watch.some(item => !queries.includes(item))){
		throw new Error('The watch option must be an array with only "info", "players" or "rules".');
	}

	return data;
}

function diferentKeys<T extends object>(a: T, b: T): Array<keyof T> {
	const keys = Object.keys(a) as Array<keyof T>;

	return keys.filter(key => a[key] !== b[key] && typeof a[key] !== 'object');
}

interface Events {
	infoUpdate: (oldInfo: ServerInfo, newInfo: ServerInfo, changed: InfoKeys) => void;
	playersUpdate: (oldPlayers: Players, newPlayers: Players) => void;
	rulesUpdate: (oldRules: Rules, newRules: Rules, changed: Array<number | string>) => void;

	playerJoin: (player: Player) => void;
	playerLeave: (player: Player) => void;

	update: () => void;
	error: (err: unknown) => void;
}

declare interface ServerWatch {
	  on<T extends keyof Events>(event: T, listener: Events[T]): this;
	emit<T extends keyof Events>(event: T, ...args: Parameters<Events[T]>): boolean;
}

class ServerWatch extends EventEmitter {
	constructor(server: Server, options: RawOptions){
		super();
		this.options = parseOptions(options, DEFAULT_OPTIONS);
		this.server = server;

		this.update();
		this.resume();
	}
	private readonly server: Server;
	private options: Options;
	private interval: NodeJS.Timeout | null = null;

	public info!: ServerInfo;
	public players!: Players;
	public rules!: Rules;

	public setOptions(options: RawOptions): this {
		this.options = parseOptions(options, this.options);
		return this;
	}

	public stop(): void {
		if(this.interval) clearInterval(this.interval);
	}

	public resume(): void {
		if(this.interval) throw new Error('The watch is already running.');
		this.interval = setInterval(() => this.update(), this.options.interval);
	}

	private update(): void {
		Promise.all(
			this.options.watch.map(x => this[`update_${x}`]())
		)
			.catch(err => {
				this.emit('error', err);
			});

		this.emit('update');
	}

	private async update_info(): Promise<void> {
		const oldInfo = this.info;
		this.info = await this.server.getInfo();

		const changed = diferentKeys(oldInfo, this.info);
		if(changed.length){
			this.emit('infoUpdate', oldInfo, this.info, changed);
		}
	}

	private async update_players(): Promise<void> {
		const oldPlayers = this.players;
		this.players = await this.server.getPlayers();
		let playersChanged = false;

		oldPlayers.list.forEach(p => {
			if(!this.players.list.some(p2 => p2.name === p.name)){
				playersChanged = true;
				this.emit('playerLeave', p);
			}
		});

		this.players.list.forEach(p => {
			if(!oldPlayers.list.some(p2 => p2.name === p.name)){
				playersChanged = true;
				this.emit('playerJoin', p);
			}
		});

		if(playersChanged){
			this.emit('playersUpdate', oldPlayers, this.players);
		}
	}

	private async update_rules(): Promise<void> {
		const oldRules = this.rules;
		this.rules = await this.server.getRules();

		const changed = diferentKeys(oldRules, this.rules);
		if(changed.length){
			this.emit('rulesUpdate', oldRules, this.rules, changed);
		}
	}

	public unref(): void {
		if(this.interval) this.interval.unref();
	}

	public ref(): void {
		if(this.interval) this.interval.ref();
	}
}

export default ServerWatch;