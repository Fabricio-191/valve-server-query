/**
 * An string with the format 'ip:port', example:
 * '0.0.0.0:27015'
 */
type address = string;

declare namespace Server {
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

	/** Info from a player in the server. */
	interface PlayerInfo {
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

	/** An object with the server info */
	interface Info {
		/** Ip and port from the server */
		address: address;
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
		appID: number | bigint;

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
		OS: 'linux' | 'windows' | 'mac';
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
		mode?: 'hunt' | 'elimination' | 'duel' | 'deathmatch' | 'vip team' | 'team elimination';
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
			port: number,
			/** Name of the spectator server for SourceTV. */
			name: string
		};

		/** Tags that describe the game according to the server. */
		keywords?: string[];

		/** The server's 64-bit GameID. If this is present, the appID is more accurate */
		gameID?: bigint;
	}

	/** An object with server's rules */
	interface Rules {
		[key: string]: string | boolean | number
	}

	/** Data to initialize the server. */
	interface Options {
		/** Maximum time (in miliseconds) to wait a server response, default: `2000` */
		timeout?: number;
		/** Whenether to show or not the incoming and outcoming packages, default: `false` */
		debug?: boolean;
		/** Whenether to show or not some warnings, default: `true`  */
		enableWarns?: boolean;
		/** Number of attempts to make a query to the server, default: `3` */
		retries?: number;
	}

	/** Data to initialize the server. */
	interface Data {
		/** Ip address or hostname to the server to connect */
		ip?: string;
		/** Port to use to send data to the server, default: `27015` */
		port?: number | string;
		options?: Options;
	}

	export function getInfo(options: Data): Promise<Server.Info>;
}

declare namespace MasterServer {
	/** Filter to use when querying a master server */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface Filter{
		/** A special filter, specifies that servers matching any of the following [x] conditions should not be returned */
		nor?: Filter;

		/** A special filter, specifies that servers matching all of the following [x] conditions should not be returned */
		nand?: Filter;

		/** Servers running dedicated */
		dedicated?: boolean;
		/** Servers using anti-cheat technology (VAC, but potentially others as well) */
		secure?: boolean;
		/** Servers running on a Linux platform */
		linux?: boolean;
		/** Servers that are password protected */
		password?: boolean;
		/** Servers that are not empty */
		empty?: boolean;
		/** Servers that are not full */
		full?: boolean;
		/** Servers that are spectator proxies */
		proxy?: boolean;
		/** Servers that are empty */
		noplayers?: boolean;
		/** Servers that are whitelisted */
		white?: boolean;
		/** Return only one server for each unique IP address matched */
		collapse_addr_hash?: boolean;

		/** Servers running the specified modification (ex. cstrike) */
		gamedir?: string;
		/** Servers running the specified map (ex. cs_italy) */
		map?: string;
		/** Servers with their hostname matching [hostname] (can use * as a wildcard) */
		name_match?: string;
		/** Servers running version [version] (can use * as a wildcard) */
		version_match?: string;

		/** Return only servers on the specified IP address (port supported and optional) */
		gameaddr?: string;

		/** Servers that are running game [appid] */
		appid?: number;
		/** Servers that are NOT running game [appid] */
		napp?: number;

		/** Servers with all of the given tag(s) in sv_tags */
		gametype?: string[];
		/** Servers with all of the given tag(s) in their 'hidden' tags (L4D2) */
		gamedata?: string[];
		/** Servers with any of the given tag(s) in their 'hidden' tags (L4D2) */
		gamedataor?: string[];
	}

	/** Data to initialize the server. */
	interface Options extends Server.Options{
		/** Minimum quantity of servers to retrieve, default: `200`  */
		quantity?: number | 'all';
		/** Region of the servers to retrieve */
		region?:
			'US_EAST' |
			'US_WEST' |
			'SOUTH_AMERICA' |
			'EUROPE' |
			'ASIA' |
			'AUSTRALIA' |
			'MIDDLE_EAST' |
			'AFRICA' |
			'OTHER';
	}

	/** Data to query the master server. */
	interface Data extends Server.Data, Options{
		/** Ip address or hostname to the master server to query, default: `'hl1master.steampowered.com'` */
		ip?: 'hl2master.steampowered.com' | 'hl1master.steampowered.com' | string;
		// /** Filter of the servers to retrieve */
		// filter?: Filter;
	}

	/** Get the source and goldsource master servers ip's */
	export function getIPs(): Promise<{
		/** GoldSource master servers ip's */
		goldSource: string[];
		/** Source master servers ip's */
		source: string[];
	}>;
}

declare namespace RCON {
	/** Options to initialize the remote console. */
	interface Data extends Server.Data{
		/** Password of RCON */
		password: string;
	}

	interface CLI{
		enable(): void;
		disable(): void;
	}

	type Command = string |
		'_fov';
}

class Server{
	/** Retrieves info from the server */
	getInfo(): Promise<Server.Info>;

	/** Retrieves a list of players in the servers */
	getPlayers(): Promise<Server.PlayerInfo[]>;

	/** Retrieves a list of the rules in the servers (aka: config) */
	getRules(): Promise<Server.Rules>;

	/**
	 * Ejecutes the A2A_PING request to the server
	 * This method is deprecated, you should use the `getInfo` method instead
	 * @deprecated
	 */
	ping(): Promise<number>;

	/** Disconnects the server */
	disconnect(): void;
}

/** An interface to use de remote console */
interface RCON{
	/** Method to execute a console command */
	exec(command: RCON.Command): Promise<string>;
	/** Method used to re-autenticate when rcon password is changed or connection is lost*/
	autenticate(password?: string): Promise<void>;
	/** Method to destroy the connection to the RCON */
	destroy(): void;
	/** A interface to the CLI */
	cli: RCON.CLI;
}

/** Make queries to a server running a valve game */
export function Server(data: Server.Data): Promise<Server>;
/** Make a remote console to a server running a valve game */
export function RCON(data?: RCON.Data): Promise<RCON>;
/** Method to query valve master servers */
export function MasterServer(data?: MasterServer.Data): Promise<address[]>;