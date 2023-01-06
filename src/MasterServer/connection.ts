import BaseConnection from '../Base/connection';
import { delay } from '../Base/utils';
import type { MasterServerData } from '../Base/options';

class MasterServerConnection extends BaseConnection {
	public async query(command: Buffer): Promise<Buffer> {
		return await super.query(command, [0x66]);
	}

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			this.socket.emit('packet', buffer.subarray(4));
		}else if(header === -2){
			throw new Error("Multi-packet shouldn't happen in master servers");
		}else{
			throw new Error('Invalid packet');
		}
	}
}

/*
Master-server rate limits:
30 per minute
60 per 5 minutes

rate limits are not shared between master servers, the problem is that master servers ip's change (not really frequently)
before:
[ '208.64.200.65', '208.64.200.39', '208.64.200.52' ]
now:
[ '208.64.201.194', '208.64.201.193', '208.64.200.65' ]

and dns.resolve fails 98% of the time, so i can't get the ip's of the master servers dynamically
while dns.lookup never fails but returns only one ipx|

master server returns a max of 231 servers per request
const CHUNK_SIZE = 231;
*/

// makes one query every 5 seconds
const TIME_BETWEEN_REQUESTS = 5000;
class SlowQueryConnection extends MasterServerConnection {
	private _lastRequest = 0;
	public async query(command: Buffer): Promise<Buffer> {
		const diff = Date.now() - this._lastRequest;
		if(diff < TIME_BETWEEN_REQUESTS){
			await delay(TIME_BETWEEN_REQUESTS - diff);
		}

		this._lastRequest = Date.now();

		return await super.query(command);
	}
}
// got a list of ~200000 servers in 1 hour and 17 minutes

// makes a max of 30 queries in 1 minute and a max of 60 queries in 5 minutes
class BulkQueryConnection extends MasterServerConnection {
	private _requestsLastMinute = 0;
	private _requestsLast5Minutes = 0;

	public async query(command: Buffer): Promise<Buffer> {
		while(this._requestsLastMinute >= 30 || this._requestsLast5Minutes >= 60) await delay(1000);

		this._requestsLastMinute++;
		this._requestsLast5Minutes++;

		setTimeout(() => this._requestsLastMinute--, 60000);
		setTimeout(() => this._requestsLast5Minutes--, 300000);

		return await super.query(command);
	}
}

export default async function createConnection(data: MasterServerData): Promise<MasterServerConnection> {
	const connection = data.slow ? new SlowQueryConnection(data) : new BulkQueryConnection(data);
	await connection.connect();

	return connection;
}