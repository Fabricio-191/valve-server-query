import BaseConnection from '../Base/connection';
import { delay, log } from '../Base/utils';
import type { MasterServerData } from '../Base/options';

/*
Master-server rate limits:
30 per minute
60 per 5 minutes => time between requests: 5 seconds

[ '208.64.200.65', '208.64.200.39', '208.64.200.52' ]
[ '208.64.201.194', '208.64.201.193', '208.64.200.65' ]
*/

const TIME_BETWEEN_REQUESTS = 5000;
class SlowThrottle {
	constructor(lastRequest = 0){
		this.lastRequest = lastRequest;
	}
	private lastRequest: number;

	public async throttle(): Promise<void> {
		const diff = Date.now() - this.lastRequest;
		if(diff < TIME_BETWEEN_REQUESTS) await delay(TIME_BETWEEN_REQUESTS - diff);

		this.lastRequest = Date.now();
	}

	public toBulk(): BulkThrottle {
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		if(this.lastRequest === 0) return new BulkThrottle();
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		return new BulkThrottle(30, 60);
	}
}

class BulkThrottle {
	constructor(requestsLastMinute = 0, requestsLast5Minutes = 0){
		this.requestsLastMinute = requestsLastMinute;
		this.requestsLast5Minutes = requestsLast5Minutes;
	}
	private requestsLastMinute: number;
	private requestsLast5Minutes: number;

	public async throttle(): Promise<void> {
		while(this.requestsLastMinute >= 30 || this.requestsLast5Minutes >= 60) await delay(100);

		this.requestsLastMinute++;
		this.requestsLast5Minutes++;

		setTimeout(() => this.requestsLastMinute--, 60000).unref();
		setTimeout(() => this.requestsLast5Minutes--, 300000).unref();
	}

	public toSlow(): SlowThrottle {
		if(this.requestsLastMinute === 0) return new SlowThrottle();
		return new SlowThrottle(Date.now());
	}
}

class MasterServerConnection extends BaseConnection<MasterServerData> {
	constructor(data: MasterServerData){
		super(data);

		this.throttle = this.data.slow ? new SlowThrottle() : new BulkThrottle();
	}

	private throttle: BulkThrottle | SlowThrottle;

	public override async query(command: Buffer): Promise<Buffer> {
		await this.throttle.throttle();
		return await super.query(command, [0x66]);
	}

	public changeMode(slow: boolean): void {
		if(this.data.slow === slow) return;
		this.data.slow = slow;

		this.throttle = slow ?
			(this.throttle as BulkThrottle).toSlow() :
			(this.throttle as SlowThrottle).toBulk();
	}

	protected onMessage(buffer: Buffer): void {
		const header = buffer.readInt32LE();
		if(header === -1){
			this.socket.emit('packet', buffer.subarray(4));
		}else if(header === -2){
			log(this.data, 'master server using multiple packets response', buffer);
			throw new Error('Master servers should not use multiple packets response');
		}else{
			log(this.data, 'cannot parse packet', buffer);
		}
	}
}

export default MasterServerConnection;