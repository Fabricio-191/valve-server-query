/* eslint-disable new-cap */
import { BufferWriter, BufferReader } from '../Base/utils';
import { parseMasterServerOptions, type RawMasterServerOptions, type MasterServerData } from '../Base/options';
import BaseConnection from '../Base/connection';
import Filter from './filter';

// 30 per minute
// 60 per 5 minutes

// master server returns a max of 231 servers per request
// const CHUNK_SIZE = 231;

class Connection extends BaseConnection {
	public async query(command: Buffer): Promise<Buffer> {
		return await super.query(command, [0x66]);
	}

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			this.socket.emit('packet', buffer.slice(4));
		}else if(header === -2){
			throw new Error("Multi-packet shouldn't happen in master servers");
		}else{
			throw new Error('Invalid packet');
		}
	}

	public static async init(data: MasterServerData): Promise<Connection> {
		const connection = new Connection(data);
		await connection.connect();

		return connection;
	}
}

function makeCommand(region: number, filter: string, last: string): Buffer {
	return new BufferWriter()
		.byte(0x31, region)
		.string(last)
		.string(filter)
		.end();
}

export default async function MasterServer(
	options: RawMasterServerOptions = {},
	onChunk: ((servers: string[]) => void) | null = null
): Promise<string[]> {
	const data = await parseMasterServerOptions(options);
	const connection = await Connection.init(data);

	let last = '0.0.0.0:0';

	const servers: string[] = [];

	do{
		const command = makeCommand(data.region, data.filter, last);

		const buffer = await connection.query(command);
		const chunk = parseServerList(buffer);

		if(onChunk) onChunk(chunk);
		servers.push(...chunk);

		last = servers[servers.length - 1] as string;
	}while(data.quantity > servers.length && last !== '0.0.0.0:0');

	if(last === '0.0.0.0:0') servers.pop();

	connection.destroy();
	return servers;
}

MasterServer.Filter = Filter;

function parseServerList(buffer: Buffer): string[] {
	const amount = (buffer.length - 2) / 6;
	if(!Number.isInteger(amount)) throw new Error('invalid server list');

	const reader = new BufferReader(buffer, 2); // skip header
	const servers = Array<string>(amount);

	for(let i = 0; i < amount; i++){
		servers[i] = reader.address('BE');
	}

	return servers;
}
