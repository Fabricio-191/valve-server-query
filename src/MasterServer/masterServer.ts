/* eslint-disable new-cap */
import { BufferWriter, BufferReader } from '../utils';
import Connection from './connection';
import Filter from './filter';
import { parseMasterServerOptions, type RawMasterServerOptions, type MasterServerData } from '../options';

const regions = [0, 1, 2, 3, 4, 5, 6, 7, 255] as const;

export { Filter };
export async function query(options: RawMasterServerOptions = {}): Promise<string[]> {
	const data = await parseMasterServerOptions(options);
	const connection = new Connection(data);
	await connection.connect();

	const servers = await getServers(connection, data);

	connection.destroy();
	return servers;
}

export async function allRegions(options: Omit<RawMasterServerOptions, 'region'> = {}): Promise<string[]> {
	const data = await parseMasterServerOptions(options);
	const connection = new Connection(data);
	await connection.connect();

	const servers = await Promise.all(
		regions.map(region => getServers(connection, {
			...data,
			region,
		}))
	);

	connection.destroy();
	return servers.flat();
}

async function getServers(connection: Connection, data: MasterServerData): Promise<string[]> {
	const servers: string[] = [];
	let last = '0.0.0.0:0';

	do{
		const command = new BufferWriter()
			.byte(0x31, data.region)
			.string(last)
			.string(data.filter)
			.end();

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
