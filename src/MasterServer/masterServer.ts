import { BufferWriter, BufferReader } from '../utils';
import Connection from './connection';
import Filter from './filter';
import { parseData, type RawOptions } from './options';

export default async function MasterServer(options: RawOptions = {}): Promise<string[]> {
	const data = await parseData(options);
	const connection = new Connection(data);
	connection.connect();
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

	connection.destroy();
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
