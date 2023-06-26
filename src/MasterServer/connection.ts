import BaseConnection from '../Base/connection';
import { delay, log } from '../Base/utils';
import type { MasterServerData } from '../Base/options';

class MasterServerConnection extends BaseConnection<MasterServerData> {
	public override async query(command: Buffer): Promise<Buffer> {
		return await super.query(command, [0x66]);
	}

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			this.socket.emit('packet', buffer.subarray(4));
		}else if(header === -2){
			throw new Error('Master servers should not use multiple packets response');
		}else{
			log(this.data, 'cannot parse packet', buffer);
		}
	}
}

const TIME_BETWEEN_REQUESTS = 5000;
class SlowQueryConnection extends MasterServerConnection {
	private _lastRequest = 0;
	public override async query(command: Buffer): Promise<Buffer> {
		const diff = Date.now() - this._lastRequest;
		if(diff < TIME_BETWEEN_REQUESTS){
			await delay(TIME_BETWEEN_REQUESTS - diff);
		}

		this._lastRequest = Date.now();

		return await super.query(command);
	}
}

class BulkQueryConnection extends MasterServerConnection {
	private _requestsLastMinute = 0;
	private _requestsLast5Minutes = 0;

	public override async query(command: Buffer): Promise<Buffer> {
		while(this._requestsLastMinute >= 30 || this._requestsLast5Minutes >= 60) await delay(100);

		this._requestsLastMinute++;
		this._requestsLast5Minutes++;

		setTimeout(() => this._requestsLastMinute--, 60000).unref();
		setTimeout(() => this._requestsLast5Minutes--, 300000).unref();

		return await super.query(command);
	}
}

export default async function createConnection(data: MasterServerData): Promise<MasterServerConnection> {
	const connection = data.slow ? new SlowQueryConnection(data) : new BulkQueryConnection(data);
	await connection.connect();

	return connection;
}

/*
Master-server rate limits:
30 per minute
60 per 5 minutes

[ '208.64.200.65', '208.64.200.39', '208.64.200.52' ]
[ '208.64.201.194', '208.64.201.193', '208.64.200.65' ]
*/
