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

const ONE_MINUTE = 60000;
const FIVE_MINUTES = 300000;
const TIME_BETWEEN_REQUESTS = 5000;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_REQUESTS_PER_5_MINUTES = 60;

interface Throttler {
	throttle(): Promise<void>;
	changeMode(mode: 'bulk' | 'slow'): Throttler;
}

class SlowThrottle implements Throttler {
	constructor(lastRequest = 0){
		this.lastRequest = lastRequest;
	}
	private lastRequest: number;

	public async throttle(): Promise<void> {
		const diff = Date.now() - this.lastRequest;
		if(diff < TIME_BETWEEN_REQUESTS) await delay(TIME_BETWEEN_REQUESTS - diff);

		this.lastRequest = Date.now();
	}

	public changeMode(mode: 'bulk' | 'slow'): BulkThrottle {
		if(mode === 'slow') throw new Error('Already slow');
		else if(mode === 'bulk'){
			const requestsLast5Minutes = (this.lastRequest - (Date.now() - FIVE_MINUTES)) / TIME_BETWEEN_REQUESTS;
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			if(requestsLast5Minutes < 0) return new BulkThrottle(0, 0);

			const requestsLastMinute = (this.lastRequest - (Date.now() - ONE_MINUTE)) / TIME_BETWEEN_REQUESTS;

			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			return new BulkThrottle(requestsLastMinute, requestsLast5Minutes);
		}

		throw new Error('Invalid mode');
	}
}

class BulkThrottle implements Throttler {
	constructor(requestsLastMinute = 0, requestsLast5Minutes = 0){
		this.requestsLastMinute = requestsLastMinute;
		this.requestsLast5Minutes = requestsLast5Minutes;
	}
	private requestsLastMinute: number;
	private requestsLast5Minutes: number;

	public async throttle(): Promise<void> {
		while(this.requestsLastMinute >= MAX_REQUESTS_PER_MINUTE || this.requestsLast5Minutes >= MAX_REQUESTS_PER_5_MINUTES) await delay(100);

		this.requestsLastMinute++;
		this.requestsLast5Minutes++;

		setTimeout(() => this.requestsLastMinute--, ONE_MINUTE).unref();
		setTimeout(() => this.requestsLast5Minutes--, FIVE_MINUTES).unref();
	}

	public changeMode(mode: 'bulk' | 'slow'): SlowThrottle {
		if(mode === 'bulk') throw new Error('Already bulk');
		else if(mode === 'slow'){
			if(this.requestsLastMinute === 0) return new SlowThrottle();
			return new SlowThrottle(Date.now());
		}

		throw new Error('Invalid mode');
	}
}

class MasterServerConnection extends BaseConnection<MasterServerData> {
	constructor(data: MasterServerData){
		super(data);

		this.throttle = this.data.mode === 'slow' ? new SlowThrottle() : new BulkThrottle();
	}

	private throttle: Throttler;

	public override async query(command: Buffer): Promise<Buffer> {
		await this.throttle.throttle();
		return await super.query(command, [0x66]);
	}

	public changeMode(mode: 'bulk' | 'slow'): void {
		if(this.data.mode === mode) return;
		this.data.mode = mode;


		this.throttle = this.throttle.changeMode(mode);
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