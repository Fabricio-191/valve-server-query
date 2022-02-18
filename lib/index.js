module.exports = {
	get Server(){
		return require('./main/server');
	},
	MasterServer: require('./main/masterServer.js'),
	RCON: require('./main/RCON.js'),
};