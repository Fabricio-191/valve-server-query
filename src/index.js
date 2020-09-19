const Server = require('./structures/server.js')

module.exports = Server;
module.exports.init = function(options){
    return new Server(options)
};