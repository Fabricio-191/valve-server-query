/**
 * An string with the format 'ip:port', example:
 * '0.0.0.0:27015'
 */
type address = string;

declare namespace MasterServer {
	/** Filter to use when querying a master server */
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

	/** Options to initialize the master server to query. */
	interface Options{
		/** Ip address or hostname to the master server to query */
		ip?: 'hl2master.steampowered.com' | 'hl1master.steampowered.com' | string;
		/** Port to use to send data to the server */
		port?: number | string;
		/** Maximum time (in miliseconds) to wait a server response, default: `1000` */
		timeout?: number;
		/** Whenether to show or not the incoming and outcoming packages, default: `false` */
		debug?: boolean;
		/** Minimum quantity of servers to retrieve  */
		quantity?: number;
		/** Filter of the servers to retrieve */
		filter?: Filter;
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
			'OTHER' | 
			'ALL';
	}
	
	/** Get the source and goldsource master servers ip's */
	export function getIPS(): Promise<{
		/** GoldSource master servers ip's */
		goldSource: string[];
		/** Source master servers ip's */
		source: string[];
	}>;
}

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
		/** Indicates the type of mod */
		type: 'multiplayer only mod' | 'single and multiplayer mod';
		/** Indicates whether mod uses its own DLL: */
		DLL: 'it uses its own DLL' | 'it uses the Half-Life DLL';
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

	/** Options to initialize the server. */
	interface Options {
		/** Ip address or hostname to the server to connect */
		ip: string;
		/** Port to use to send data to the server, default: `27015` */
		port?: number | string;
		/** Maximum time (in miliseconds) to wait a server response, default: `1000` */
		timeout?: number;
		/** Whenether to show or not the incoming and outcoming packages, default: `false` */
		debug?: boolean;
	}
	
	export class Server {
		/**
		 * @param options Options to initialize the server
		 */
		constructor(options?: Options);

		/** Retrieves info from the server */
		getInfo(): Promise<Info>;

		/** Retrieves a list of players in the servers */
		getPlayers(): Promise<PlayerInfo[]>;

		/** Retrieves a list of the rules in the servers (aka: config) */
		getRules(): Promise<Rules>;

		/**
		 * Ejecutes the A2A_PING request to the server
		 * This method is deprecated, you should use the `getInfo` method instead
		 * @deprecated
		 */
		ping(): Promise<number>;

			
		/**
		 * Connects to a server
		 * returns a promise that is resolved when the connection is complete
		 */
		connect(options: Server.Options): Promise<void>;
			
		/** Disconnects the server */
		disconnect(): void;

		static init(options?: Server.Options): Server;

		static getInfo(options: Server.Options): Promise<Server.Info>;
	}
}

/** Make queries to a server running a valve game */
declare function Server(): Server.Server;
/** Make queries to a server running a valve game */
declare function Server(options: Server.Options): Promise<Server.Server>;
/**
 * Method to query valve master servers
 * @param options options for the query
 */
declare function MasterServer(options?: MasterServer.Options): Promise<address[]>;
/**
 * If the value is false, the socket will not keep the node.js process alive
 * @param value Whenether to ref or not the socket
 */
declare function setSocketRef(value: boolean): Exports;

interface Exports{
	/** Make queries to a server running a valve game */
	Server(): Server.Server,
	/** Make queries to a server running a valve game */
	Server(options: Server.Options): Promise<Server.Server>,
	
	/**
	 * Method to query valve master servers
	 * @param options options for the query
	 */
	MasterServer(options?: MasterServer.Options): Promise<address[]>,
	
	/**
	 * If the value is false, the socket will not keep the node.js process alive
	 * @param value Whenether to ref or not the socket
	 */
	setSocketRef(value: boolean): Exports,
}

export {
	Server,
	MasterServer,
	setSocketRef
}