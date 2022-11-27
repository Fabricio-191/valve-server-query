import Server from './Server/server';
import MasterServer from './MasterServer/masterServer';
import RCON from './RCON/RCON';

export type {
	ServerInfo,
	GoldSourceServerInfo,
	TheShipServerInfo,
	FinalServerInfo,
	Player,
	TheShipPlayer
} from './Server/serverParsers';

export { Server, MasterServer, RCON };
export default {
	Server,
	MasterServer,
	RCON,
};