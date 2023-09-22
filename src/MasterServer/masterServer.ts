/* eslint-disable new-cap */
import { parseMasterServerOptions, type RawMasterServerOptions } from '../Base/options';
import { BufferReader } from '../Base/utils';
import MasterServerConnection from './connection';
import Filter from './filter';
import EventEmitter from 'events';

const ZERO_IP = '0.0.0.0:0';

function makeCommand(region: number, filter: string, last: string): Buffer {
	/*
	return new BufferWriter()
		.byte(0x31, region)
		.string(last)
		.string(filter)
		.end();
	*/
	const buffer = Buffer.allocUnsafe(6 + filter.length);
	buffer[0] = 0x31;
	buffer[1] = region;
	buffer.write(last, 2, 4, 'ascii');
	buffer.write(filter, 6, filter.length, 'ascii');
	return buffer;
}

export default class MasterServerRequest extends EventEmitter {
	constructor(options: RawMasterServerOptions = {}){
		super();

		const data = parseMasterServerOptions(options);
		this.remaining = data.quantity;
		this.connection = new MasterServerConnection(data);

		this.connection.connect()
			.then(async () => {
				let last = ZERO_IP;

				do{
					const command = makeCommand(data.region, data.filter, last);

					const buffer = await this.connection.query(command);
					const chunk = parseServerList(buffer);

					last = chunk.pop()!;
					this.remaining -= chunk.length;

					this.emit('chunk', chunk);
				}while(this.remaining > 0 && last !== ZERO_IP);

				await this.connection.destroy();
				this.emit('end');
			})
			.catch(err => {
				this.emit('error', err);
				this.emit('end');
			});
	}
	private remaining: number;
	private readonly connection: MasterServerConnection;

	private _nextChunk(): Promise<string[]> {
		return new Promise((res, rej) => {
			this.once('chunk', res);
			this.once('error', rej);
		});
	}

	public end(): Promise<string[]> {
		this.connection.changeMode(false);

		return new Promise((res, rej) => {
			const servers: string[] = [];
			this.on('chunk', (chunk: string[]) => servers.push(...chunk));
			this.on('end', () => res(servers));
			this.on('error', rej);
		});
	}

	public async* [Symbol.asyncIterator](): AsyncGenerator<string> {
		while(this.remaining > 0){
			const chunk = await this._nextChunk();
			yield* chunk;
		}
	}
}

/*
export default async function MasterServer(
	options: RawMasterServerOptions = {},
	onChunk: ((servers: string[]) => void) | null = null
): Promise<string[]> {
	const data = parseMasterServerOptions(options);
	const connection = await createConnection(data);

	const servers: string[] = [];

	if(last === ZERO_IP) servers.pop();

	await connection.destroy();
	return servers;
}
*/

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
