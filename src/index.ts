import Server from './Server/server copy';
import MasterServer from './MasterServer/masterServer';
import RCON from './RCON/RCON';
import { debug } from './Base/utils';
import { setDefaultOptions } from './Base/options';

const enableDebug = debug.enable;

export type {
	ServerInfo, GoldSourceServerInfo,
	TheShipServerInfo,
	AnyServerInfo,
	Player, TheShipPlayer
} from './Server/parsers';

export { Server, MasterServer, RCON, enableDebug, debug, setDefaultOptions };
export default { Server, MasterServer, RCON, enableDebug, debug, setDefaultOptions };
