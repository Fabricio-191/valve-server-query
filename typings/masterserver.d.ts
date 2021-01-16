import { ServerOptions } from './server';

/**
 * Method to query valve master servers
 * @param options options for the query
 */
declare function MasterServer(options: MasterServerOptions): Promise<string[]>;

interface MasterServersIPS{
    /** GoldSource master servers ip's */
    goldSource: string[];
    /** Source master servers ip's */
    source: string[];
}

/** Get the source and goldsource master servers ip's */
export declare function getIPS(): Promise<MasterServersIPS>;

/** Options to initialize the master server to query. */
interface MasterServerOptions extends ServerOptions{
    /** Minimum quantity of servers to retrieve  */
    quantity?: number;
    /** Filter of the servers to retrieve */
    filter?: MasterServerFilter;
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

/** Filter to use when querying a master server */
interface MasterServerFilter{
    /** A special filter, specifies that servers matching any of the following [x] conditions should not be returned */
    nor?: MasterServerFilter;

    /** A special filter, specifies that servers matching all of the following [x] conditions should not be returned */
    nand?: MasterServerFilter;

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
 

declare namespace MasterServer {
    export { getIPS };
}

export default MasterServer;