/* eslint-disable new-cap */
import { BufferWriter, BufferReader, delay } from '../Base/utils';
import Filter from './filter';
import * as Options from '../Base/options';
import BaseConnection from '../Base/connection';

class Connection extends BaseConnection<Options.MasterServerData> {
	private _counter = 0;

	public async query(command: Buffer, ...responseHeaders: number[]): Promise<Buffer> {
		if(this._counter === 25) await delay(1000);

		this._counter++;
		setTimeout(() => this._counter--, 62000).unref();

		return await super.query(command, ...responseHeaders);
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
}

export default async function MasterServer(options: Options.RawMasterServerOptions = {}): Promise<string[]> {
	const data = await Options.parseMasterServerOptions(options);
	const connection = new Connection(data);
	await connection.connect();

	const filter = data.filter.toString();
	const servers: string[] = [];
	let last = '0.0.0.0:0';

	do{
		const command = makeCommand(last, data.region, filter);

		const buffer = await connection.query(command, 0x66);
		servers.push(...parseServerList(buffer));

		last = servers[servers.length - 1] as string;
	}while(data.quantity !== servers.length && last !== '0.0.0.0:0');

	if(last === '0.0.0.0:0') servers.pop();

	connection.destroy();
	return servers;
}

MasterServer.Filter = Filter;
MasterServer.REGIONS = Options.REGIONS;

function makeCommand(last: string, region: number, filter: string): Buffer {
	return new BufferWriter()
		.byte(0x31, region)
		.string(last)
		.string(filter)
		.end();
}

function parseServerList(buffer: Buffer): string[] {
	const amount = (buffer.length - 2) / 6; // 6 = 4 bytes for IP + 2 bytes for port
	if(!Number.isInteger(amount)) throw new Error('invalid server list');

	const reader = new BufferReader(buffer, 2); // skip header
	const servers = Array<string>(amount);

	for(let i = 0; i < amount; i++){
		servers[i] = reader.address('BE');
	}

	return servers;
}
