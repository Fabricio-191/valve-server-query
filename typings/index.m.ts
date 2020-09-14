type serverTypes = 'dedicated' | 'non-dedicated' | 'source tv relay' | null;
type serverOS = 'linux' | 'windows' | 'mac';
type theShipModes = 'hunt' | 'elimination' | 'duel' | 'deathmatch' | 'vip team' | 'team elimination';

interface Time{
    hours: number;
    minutes: number;
    seconds: number;
    start: Date;
}

interface server{
    ip: string,
    port?: number
}

interface ModInfo{
    link: string;
    downloadLink: string;
    version: number;
    size: number;
    type: 'multiplayer only mod' | 'single and multiplayer mod';
    DLL: 'it uses its own DLL' | 'it uses the Half-Life DLL';
}

interface PlayerInfo{
    index: number;
    name: string;
    score: number;
    timeOnline: Time;

    deaths?: number;
    money?: number;
}

interface ServerInfo{
    address?: string;
    protocol: number;
    name: string;
    map: string;
    folder: string;
    game: string;
    appID: number;
   
    players: {
        online: number;
        max: number;
        bots: number;
        list?: PlayerInfo[];
    };
    type: serverTypes;
    OS: serverOS;
    visibility: 'private' | 'public';
    VAC: boolean;
    mod?: boolean;
    modInfo?: ModInfo;

    mode?: theShipModes;
    witnesses?: number;
    duration?: number;

    version?: string;

    port?: number;
    steamID?: number;

    ['tv-port']?: number;
    ['tv-name']?: string;

    keywords?: string[];

    gameID?: number;

    isGoldSource: boolean;
    ping: number;
}


declare class Server{
    constructor(server: server, timeoutTime: number);

    getInfo(): Promise<ServerInfo>;
    getPlayers(): Promise<PlayerInfo[]>;
    getRules(): Promise<object>;

    getAll(): Promise<ServerInfo>;    
}

export = Server;