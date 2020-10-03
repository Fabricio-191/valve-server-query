const { client } = require('./structures/connectionManager.js');

module.exports = {
	Server: require('./structures/server.js'),
	MasterServer: require('./structures/masterServer.js'),
	setSocketRef(value){
		if(typeof value !== 'boolean') throw Error("'value' must be a boolean");

		client[
			value ? 'ref' : 'unref'
		]();
	}
};