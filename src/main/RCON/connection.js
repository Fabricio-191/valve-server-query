const { parsers, debug, parseData, BufferWriter } = require('../../utils/utils.js');
const net = require('net');

class Connection{
	type = 'RCON';
	client = null;

	ip = 'localhost';
	port = 27015;

	password = null;

	options = {
		debug: false,
		timeout: 2000,
		retries: 3,
		enableWarns: true,
	}

	send(command){
		if(this.options.debug) debug('RCON', 'sending:', command);

		return new Promise((res, rej) => {
			this.client.on('error', rej);

			this.client.write(command, 'ascii', err => {
				this.client.off('error', rej);
				if(err) return rej(err);

				res();
			});
		});
	}

	awaitResponse(ID, responseType){
		return new Promise((res, rej) => {
			const clear = this._await('packet', 'Response timeout.', handler);

			function handler(err, packet){
				if(err){
					rej(err);
					clear();
				}

				if(
					!packet ||
					packet.type !== responseType ||
					packet.ID !== ID && packet.ID !== -1
				) return;

				clear();

				res(packet);
			}
		});
	}

	awaitMultipleResponse(){
		if(this.options.debug) debug('RCON', 'mutiple packet response');
		const packets = [];

		return new Promise((res, rej) => {
			const clear = this._await(
				'data', 'Response timeout.',
				(err, buf) => {
					if(err){
						clear(); rej(err);
					}

					if(buf.length < 500) return;
					packets.push(buf);
				},
			);

			this.query()
				.then(() => res(packets))
				.catch(rej)
				.finally(clear);
		});
	}

	_await(event, timeoutErr, callback){ // callback(err, ...args);
		const err = new Error(timeoutErr);
		const eventCallback = callback.bind(this, null);

		const clear = () => {
			this.client.off(event, eventCallback);
			this.client.off('error', callback);
			// eslint-disable-next-line no-use-before-define
			clearTimeout(timeout);
		};

		const timeout = setTimeout(callback, this.options.timeout, err);

		this.client.on(event, eventCallback);
		this.client.on('error', callback);

		return clear;
	}

	query(
		body = '',
		ID = this.generateID(),
		types = { REQUEST: 2, RESPONSE: 0 },
	){
		const command = (new BufferWriter)
			.long(Buffer.byteLength(body) + 10) // size
			.long(ID)
			.long(types.REQUEST)
			.string(body)
			.byte(0)
			.end();

		const time = this.options.timeout * 0.9 / this.options.retries;

		return new Promise((res, rej) => {
			const interval = setInterval(() => {
				this.send(command)
					.catch(err => {
						clearInterval(interval);
						rej(err);
					});
			}, time);

			this.awaitResponse(ID, types.RESPONSE)
				.then(res)
				.catch(rej)
				.finally(() => {
					clearInterval(interval);
				});
		});
	}

	_IDs_CACHE = new Set([-1]);
	generateID(){
		const ID = Math.floor(Math.random() * 0xFFFFFFFF) - 0x80000000;

		if(this._IDs_CACHE.has(ID)){
			return this.generateID();
		}

		this._IDs_CACHE.add(ID);
		setTimeout(
			() => this._IDs_CACHE.delete(ID),
			this.options.timeout + 100,
		);

		return ID;
	}
}

module.exports = async function createConnection(data){
	const connection = new Connection;

	data = await parseData(data, 'RCON');
	Object.assign(connection, data);

	connection.client = net.createConnection({
		host: data.ip,
		port: data.port,
	})
		.on('data', buffer => {
			if(data.options.debug){
				debug('RCON', 'recieved:', buffer);
			}
			if(!buffer || buffer.length === 0) return;

			const packet = parsers.RCONPacket(buffer);

			connection.client.emit('packet', packet);
		})
		.unref()
		.setMaxListeners(30);

	await new Promise((res, rej) => {
		const clear = connection._await('connect', 'Connection timeout.', err => {
			clear();
			if(err) return rej(err);
			res();
		});
	});

	if(data.options.debug) debug('RCON', 'connected');

	return connection;
};