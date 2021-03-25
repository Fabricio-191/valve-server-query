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

/*
class CLI{
	constructor(rcon){
		this.rcon = rcon;
	}

	logError(err){
		console.error(err.message);
	}

	awaitInput(div){
		process.stdout.write(div || '\x1B[35m> \x1B[0m');

		return new Promise(res => {
			process.stdin.once('data', buffer => {
				if(!this.enabled) return;
				const command = buffer.toString()
					.trim()
					.split('\n')
					.pop();

				res(command);
			});
		});
	}

	awaitCommand(){
		this.awaitInput()
			.then(command => this.rcon.exec(command))
			.catch(this.logError)
			.finally(() => {
				console.log('\n');
				this.awaitCommand();
			});
	}

	awaitPassword(){
		this.enabled = false;

		this.awaitInput('\x1B[31mpassword > \x1B[0m')
			.then(password => this.rcon.authenticate(password))
			.then(() => {
				this.enabled = true;
			})
			.catch(this.logError)
			.finally(() => {
				console.log('\n');
				this.awaitCommand();
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
*/

class RCON{
	connection = null;
	// cli = null;

	async exec(command){
		if(!this.connection) throw new Error('RCON is not connected');
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

	/*
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
	*/

	destroy(){
		this.connection.client.destroy();
		this.connection = null;
		// if(this.cli.enabled) this.cli.disable();
	}
}

module.exports = async function createRCON(options){
	const connection = await createConnection(options);
	const rcon = new RCON;
	rcon.connection = connection;

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
	if(connection.options.enableWarns || connection.options.debug){
		debug('RCON', 'connection closed, reconnecting...');
	}

	rcon.connection = (async function(){
		connection.client.connect();

		await new Promise((res, rej) => {
			connection._await('connect', 'Connection closed.', (clear, err) => {
				clear();
				if(err){
					rej(err);
					connection = null;
				}
				res();
			});
		});

		if(connection !== null){
			try{
				await authenticate(connection);
			}catch(e){
				console.error(new Error('Password changed, connection closed'));
			}
		}

		rcon.connection = connection;
	})();
}
