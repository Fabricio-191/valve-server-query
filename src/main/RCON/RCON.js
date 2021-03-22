const { debug } = require('../../utils/utils.js');
const createConnection = require('./connection.js');

const RCON_TYPES = {
	EXEC: {
		REQUEST: 2,
		RESPONSE: 0,
	},
	AUTH: {
		REQUEST: 3,
		RESPONSE: 2,
	},
};

class CLI{
	constructor(rcon){
		this.rcon = rcon;
	}
	async awaitCommand(){
		await this.rcon.connection;

		process.stdout.write('\x1B[35m> \x1B[0m');

		process.stdin.once('data', buffer => {
			if(!this.enabled) return;
			const command = buffer.toString().trim();

			this.rcon.exec(command)
				.then(result => {
					process.stdout.write(result);
				})
				.catch(console.error)
				.finally(() => {
					console.log('\n');
					this.awaitCommand();
				});
		});
	}

	enabled = false;

	enable(){
		this.enabled = true;
		this.awaitCommand();
	}

	disable(){
		this.enabled = false;
	}
}

class RCON{
	constructor(connection){
		this.connection = connection;
		this.cli = new CLI(this);
	}
	connection = null;
	cli = null;

	async exec(command){
		if(!this.connection) throw new Error('RCON has been destroyed');
		await this.connection;

		const response = await this.connection.query(command);
		const chunks = [response.body];

		if(response.body.length > 500){
			const packets = await this.connection.awaitMultipleResponse();

			chunks.push(...packets);
		}

		return Buffer
			.concat(chunks)
			.toString('ascii');
	}

	autenticate(password = this.connection.password){
		if(password === ''){
			throw new Error('RCON password cannot be an empty string');
		}else if(typeof password !== 'string'){
			throw new Error('RCON password must be a string');
		}

		if(password !== this.connection.password){
			this.connection.password = password;
		}

		return authenticate(this.connection);
	}

	destroy(){
		this.connection.client.destroy();
		this.connection = null;
		if(this.cli.enabled) this.cli.disable();
	}
}

module.exports = async function createRCON(options){
	const connection = await createConnection(options);
	const rcon = new RCON(connection);

	await authenticate(connection);

	connection.client.once('end', () => onEnd(rcon, connection));

	return rcon;
};

async function authenticate(connection){
	const ID = connection.generateID();

	const [AUTH_RESPONSE] = await Promise.all([
		connection.query(connection.password, ID, RCON_TYPES.AUTH),
		connection.awaitResponse(ID, 0),
	]);

	if(AUTH_RESPONSE.ID === -1){
		throw new Error('RCON: wrong password');
	}

	if(connection.options.debug) debug('RCON', 'autenticated');

	return connection;
}

function onEnd(rcon, connection){
	rcon.connection = (async function(){
		connection.connect();

		await new Promise((res, rej) => {
			connection._await(
				'connect', 'Connection closed.',
				(clear, err) => {
					clear();
					if(err) rej(err);
					res();
				},
			);
		});

		try{
			await authenticate(connection);
		}catch(e){
			throw new Error('Password changed, connection closed');
		}
	})();
}
