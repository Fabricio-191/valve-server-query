import type EventEmitter from 'events';

declare module '@fabricio-191/valve-server-query' {
	/**
	 * An string with the format 'ip:port', example:
	 * '0.0.0.0:27015'
	 */
	type address = string;

	namespace Server {
		/** Data to initialize the server. */
		interface Options {
			/** Ip address or hostname to the server to connect */
			ip?: string;
			/** Port to use to send data to the server, default: `27015` */
			port?: number;
			/** Maximum time (in miliseconds) to wait a server response, default: `2000` */
			timeout?: number;
			/** Whenether to show or not the incoming and outcoming packages, default: `false` */
			debug?: boolean;
			/** Whenether to show or not some warnings, default: `true`  */
			enableWarns?: boolean;
			/** Number of attempts to make a query to the server, default: `3` */
			retries?: number;
		}

		export function getInfo(options: Options): Promise<Info>;
	}

	namespace MasterServer {

		/** Data to query the master server. */
		interface Data extends Server.Options{
			/** Ip address or hostname to the master server to query, default: `'hl1master.steampowered.com'` */
			ip?: 'hl1master.steampowered.com' | 'hl2master.steampowered.com' | string & {};
			/** Port to use default: `27011` */
			port?: number;
			/** Minimum quantity of servers to retrieve, default: `200`  */
			quantity?: number | 'all';
			/** Region of the servers to retrieve */
			region?:
			'AFRICA' | 'ASIA' | 'AUSTRALIA' | 'EUROPE' | 'MIDDLE_EAST' | 'OTHER' | 'SOUTH_AMERICA' | 'US_EAST' | 'US_WEST';
			/** Filter of the servers to retrieve */
			filter?: Filter;
		}
	}

	namespace RCON {
		/** Options to initialize the remote console. */
		interface Data extends Server.Options{
			/** Password of RCON */
			password: string;
		}
	}

	/** An interface to use the remote console */
	interface RCON extends EventEmitter{
		/** Method to execute a console command */
		exec(command: RCON.Command): Promise<string>;
		/** Method used to authenticate */
		authenticate(password?: string): Promise<void>;
		/** Method used to re-connect when rcon password is changed or connection is lost */
		reconnect(): Promise<void>;
		/** Method to destroy the connection to the RCON */
		destroy(): void;

		on(event: 'disconnect', listener: (reason: string) => any): this;
		on(event: 'passwordChange', listener: () => any): this;
	}

	/** Make queries to a server running a valve game */
	export function Server(data?: Server.Data): Promise<Server>;
	/** Make a remote console to a server running a valve game */
	export function RCON(data?: RCON.Data): Promise<RCON>;
	/** Method to query valve master servers */
	export function MasterServer(data?: MasterServer.Data): Promise<address[]>;
}
