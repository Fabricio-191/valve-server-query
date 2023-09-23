import Server from './Server/server';
import MasterServerRequest from './MasterServer/masterServer';
import RCON from './RCON/RCON';
import { log } from './Base/utils';

const enableLog = log.enable;

export type {
	ServerInfo, GoldSourceServerInfo,
	TheShipServerInfo,
	AnyServerInfo,
	Player, TheShipPlayer
} from './Server/parsers';

export { Server, MasterServerRequest, RCON, enableLog, log };
export default { Server, MasterServerRequest, RCON, enableLog, log };
