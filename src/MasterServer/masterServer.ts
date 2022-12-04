/* eslint-disable new-cap */
import { BufferWriter, BufferReader } from '../Base/utils';
import Filter from './filter';
import { parseMasterServerOptions, type RawMasterServerOptions, type MasterServerData } from '../Base/options';
import BaseConnection from '../Base/connection';

class Connection extends BaseConnection {
	public readonly data!: MasterServerData;

	public onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			this.socket.emit('packet', buffer.slice(4));
		}else if(header === -2){
			throw new Error('Multi-packet shouldn\'t happen in master servers');
		}else{
			throw new Error('Invalid packet');
		}
	}
}

export default async function MasterServer(options: RawMasterServerOptions = {}): Promise<string[]> {
	const data = await parseMasterServerOptions(options);
	const connection = new Connection(data);
	await connection.connect();

	const servers = await getServers(connection, data);

	connection.destroy();
	return servers;
}

function makeCommand(last: string, region: number, filter: string): Buffer {
	return new BufferWriter()
		.byte(0x31, region)
		.string(last)
		.string(filter)
		.end();
}

async function getServers(connection: Connection, data: MasterServerData): Promise<string[]> {
	const servers: string[] = [];
	let last = '0.0.0.0:0';

	do{
		const command = makeCommand(last, data.region, data.filter.toString());

		// eslint-disable-next-line @typescript-eslint/init-declarations
		let buffer: Buffer;
		try{
			buffer = await connection.query(command, 0x66);
		}catch(e){
			if(servers.length === 0) throw e;
			// eslint-disable-next-line no-console
			if(data.enableWarns) console.error(new Error('cannot get full list of servers'));
			break;
		}

		servers.push(...parseServerList(buffer));

		last = servers[servers.length - 1] as string;
	}while(data.quantity > servers.length && last !== '0.0.0.0:0');

	return servers;
}

MasterServer.Filter = Filter;

function parseServerList(buffer: Buffer): string[] {
	const amount = (buffer.length - 2) / 6; // 6 = 4 bytes for IP + 2 bytes for port
	if(!Number.isInteger(amount)) throw new Error('invalid server list');

	const reader = new BufferReader(buffer, 2); // skip header
	const servers = Array<string>(amount);

	for(let i = 0; i < amount; i++){
		servers[i] = `${reader.byte()}.${reader.byte()}.${reader.byte()}.${reader.byte()}:${reader.short(true, 'BE')}`;
	}

	return servers;
}
