import { EventEmitter } from 'events';
import Server from './server';
import type { FinalServerInfo as ServerInfo, Players, Rules } from './parsers';
import type { RawServerOptions } from '../Base/options';

type InfoKeys = Array<keyof ServerInfo>;
type Player = Players['list'][number];

interface Options {
	interval: number;
}

function diferentKeys<T extends object>(a: T, b: T): Array<keyof T> {
	const keys = Object.keys(a) as Array<keyof T>;

	return keys.filter(key => a[key] !== b[key] && typeof a[key] !== 'object');
}

interface Events {
	'infoUpdate': (oldInfo: ServerInfo, newInfo: ServerInfo, changed: InfoKeys) => void;
	'playersUpdate': (oldPlayers: Players, newPlayers: Players) => void;
	'rulesUpdate': (oldRules: Rules, newRules: Rules, changed: Array<number | string>) => void;

	'playerJoin': (player: Player) => void;
	'playerLeave': (player: Player) => void;

	'update': () => void;
	'error': (err: unknown) => void;
}

declare interface ServerWithEvents {
	on<T extends keyof Events>(
		event: T, listener: Events[T]
	): this;

	emit<T extends keyof Events>(
		event: T, ...args: Parameters<Events[T]>
	): boolean;
}

class ServerWithEvents extends EventEmitter {
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
		await this.update();
		this.start();
	}

	public start(): void {
		this.interval = setInterval(() => {
			this.update().catch(err => {
				clearInterval(this.interval);
				this.emit('error', err);
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

		const changed = diferentKeys(oldRules, this.rules);
		if(changed.length){
			this.emit('rulesUpdate', oldRules, this.rules, changed);
		}
	}
}

export default ServerWithEvents;