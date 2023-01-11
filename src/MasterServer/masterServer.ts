/* eslint-disable new-cap */
import { BufferWriter, BufferReader } from '../Base/utils';
import { parseMasterServerOptions, type RawMasterServerOptions } from '../Base/options';
import Filter from './filter';
import createConnection from './connection';

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
	const connection = await createConnection(data);

	const servers: string[] = [];
	let last = '0.0.0.0:0';

	do{
		const command = makeCommand(data.region, data.filter, last);

		const buffer = await connection.query(command);
		const chunk = parseServerList(buffer);

		if(onChunk) onChunk(chunk);
		servers.push(...chunk);

		last = servers.pop() as string;
	}while(data.quantity > servers.length && last !== '0.0.0.0:0');

	if(last === '0.0.0.0:0') servers.pop();

	connection.destroy();
	return servers;
}

MasterServer.Filter = Filter;

function parseServerList(buffer: Buffer): string[] {
	const reader = new BufferReader(buffer, 2);
	const amount = reader.remainingLength / 6;
	if(!Number.isInteger(amount)) throw new Error('invalid server list');

	const servers = Array<string>(amount);

	for(let i = 0; i < amount; i++){
		servers[i] = reader.address();
	}

	return servers;
}
