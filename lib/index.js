module.exports = {
	get Server(){
		return require('./main/server.js');
	},
	MasterServer: require('./main/masterServer.js'),
	RCON: require('./main/RCON.js'),
};