type serverTypes = 'dedicated' | 'non-dedicated' | 'source tv relay' | null;
type serverOS = 'linux' | 'windows' | 'mac';
type theShipModes = 'hunt' | 'elimination' | 'duel' | 'deathmatch' | 'vip team' | 'team elimination';

/** An object representing time */
interface Time{
    /** Hours */
    hours: number;
    /** Minutes */
    minutes: number;
    /** Seconds */
    seconds: number;
    /** Since when is counting */
    start: Date;
}

interface Options{
    /** Ip address to the server to connect */
    ip?: string,
    /** Port to use to send data to the server */
    port?: number,
    /** If it's true, it shows sent and recieved data */
    debug?: boolean,
    /** Maximum time to wait a server response */
    timeout?: number
}

/** Info from a mod from the game in the server. */
interface ModInfo{
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
interface PlayerInfo{
    index: number;

    /** Name of the player */
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
interface ServerInfo{
    /** IP address and port of the server. (provided in the server response) */
    address?: string;
    /** Protocol version used by the server. */
    protocol: number;
    /** Name of the server. */
    name: string;
    /** Map the server has currently loaded. */
    map: string;
    /** Name of the folder containing the game files. */
    folder: string;
    /** Full name of the game. */
    game: string;
    /** Steam Application ID of game. */
    appID: number;
   
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
    type: serverTypes;
    /** Indicates the operating system of the server (windows, linux or mac) */
    OS: serverOS;
    /** Indicates whether the server requires a password */
    visibility: 'private' | 'public';
    /**	Specifies whether the server uses VAC */
    VAC: boolean;
    /** Indicates whether the game is a mod */
    mod?: boolean;  
    /** These field is only present if there is a mod */
    modInfo?: ModInfo;

    /** 
     * This field only exist in a response if the server is running The Ship
     * Indicates the game mode (hunt, elimination, duel, deathmatch, vip team, team elimination)
    */
    mode?: theShipModes;
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
    steamID?: number;

    /** Spectator port number for SourceTV. */
    ['tv-port']?: number;
    /** Name of the spectator server for SourceTV. */ 
    ['tv-name']?: string;

    /** Tags that describe the game according to the server. */
    keywords?: string[];

    /** The server's 64-bit GameID. If this is present, the appID is more accurate */
    gameID?: number;

    /** Whether the server uses a goldsource engine */
    isGoldSource: boolean;
    /** Response delay from the server (in ms) */
    ping: number;
}


declare class Server{
    /**
     * @class Server - this server class
     * @param options Options
    */
    constructor(options: Options);

    /**
     * Retrieves info from the server
     * @returns The server info
    */
    getInfo(): Promise<ServerInfo>;

    
    /**
     * Retrieves a list of players in the servers
     * @returns The list of players
    */
    getPlayers(): Promise<PlayerInfo[]>;

    /**
     * Retrieves a list of the rules in the servers (aka: config)
     * @returns The list of rules
    */
    getRules(): Promise<object>;
}

export = Server;