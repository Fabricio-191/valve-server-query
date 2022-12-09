import { EventEmitter } from 'events';
import Server from './server';
import type { FinalServerInfo as ServerInfo, Players, Rules } from './parsers';
import type { RawServerOptions } from '../Base/options';

type InfoKeys = Array<keyof ServerInfo>;
type Player = Players['list'][number];

interface Options {
	interval: number;
}

function diferentKeys<T>(a: T, b: T): Array<keyof T> {
	const keys: Array<keyof T> = [];

	for(const key in b){
		if(a[key] !== b[key]){
			keys.push(key);
		}
	}
	return keys;
}

interface Events {
	'infoUpdate': (oldInfo: ServerInfo, newInfo: ServerInfo, changed: InfoKeys) => void;
	'playersUpdate': (oldPlayers: Players, newPlayers: Players) => void;
	'playerJoin': (player: Player) => void;
	'playerLeave': (player: Player) => void;
	'rulesUpdate': (oldRules: Rules, newRules: Rules, changed: string[]) => void;
	'update': () => void;
	'error': () => void;
}

declare interface ServerA {
	on<T extends keyof Events>(
		event: T, listener: Events[T]
	): this;

	emit<T extends keyof Events>(
		event: T, ...args: Parameters<Events[T]>
	): boolean;
}

class ServerA extends EventEmitter {
	constructor(options: Options){
		super();
		this.options = options;
		this.server = new Server();
	}
	private readonly options: Options;
	private readonly server: Server;
	private interval!: NodeJS.Timeout;

	public info!: ServerInfo;
	public players!: Players;
	public rules!: Rules;

	public async connect(options: RawServerOptions): Promise<void> {
		await this.server.connect(options);

		this.info = await this.server.getInfo();
		this.players = await this.server.getPlayers();
		this.rules = await this.server.getRules();
		this.start();
	}

	public start(): void {
		this.interval = setInterval(() => {
			this.update().catch(() => {
				clearInterval(this.interval);
				this.emit('error');
			});
		}, this.options.interval);
	}

	private async update(): Promise<void> {
		await Promise.all([
			this.updateInfo(),
			this.updatePlayers(),
			this.updateRules(),
		]);

		this.emit('update');
	}

	private async updateInfo(): Promise<void> {
		const oldInfo = this.info;
		this.info = await this.server.getInfo();

		const changed = diferentKeys(oldInfo, this.info);

		if(changed.length){
			this.emit('infoUpdate', oldInfo, this.info, changed);
		}
	}

	private async updatePlayers(): Promise<void> {
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

	private async updateRules(): Promise<void> {
		const oldRules = this.rules;
		this.rules = await this.server.getRules();

		const changed = diferentKeys(oldRules, this.rules) as string[];

		if(changed.length){
			this.emit('rulesUpdate', oldRules, this.rules, changed);
		}
	}
}

export default ServerA;