const { clients } = require('./structures/connection.js');

module.exports = {
	Server: require('./structures/server.js'),
	MasterServer: require('./structures/masterServer.js'),
	setSocketRef(value){
		if(typeof value !== 'boolean') throw Error("'value' must be a boolean");

		clients.udp4[
			value ? 'ref' : 'unref'
		]();

		clients.udp6[
			value ? 'ref' : 'unref'
		]();

		return this;
	},
};