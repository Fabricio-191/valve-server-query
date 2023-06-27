import Server from './Server/server';
import MasterServer from './MasterServer/masterServer';
import RCON from './RCON/RCON';
import { log } from './Base/utils';

const enableLog = log.enable;

export type {
	ServerInfo, GoldSourceServerInfo,
	TheShipServerInfo,
	AnyServerInfo,
	Player, TheShipPlayer
} from './Server/parsers';

export { Server, MasterServer, RCON, enableLog, log };
export default { Server, MasterServer, RCON, enableLog, log };
