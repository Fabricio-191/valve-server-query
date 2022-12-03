import { debug } from '../Base/utils';
import type { MasterServerData } from '../Base/options';
import BaseConnection from '../Base/connection';

export default class Connection extends BaseConnection {
	public readonly data!: MasterServerData;

	public onMessage(buffer: Buffer): void {
		if(this.data.debug) debug('MASTERSERVER recieved:', buffer);

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
