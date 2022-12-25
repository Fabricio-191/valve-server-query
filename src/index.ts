import Server from './Server/server';
import MasterServer from './MasterServer/masterServer';
import RCON from './RCON/RCON';
import { debug } from './Base/utils';

const enableDebug = debug.enable;

export type {
	ServerInfo, GoldSourceServerInfo,
	TheShipServerInfo,
	FinalServerInfo,
	Player, TheShipPlayer
} from './Server/parsers';

export { Server, MasterServer, RCON, enableDebug };
export default { Server, MasterServer, RCON, enableDebug };
