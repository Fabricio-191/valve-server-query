const Server = require('../');
const fetch = require('node-fetch');

fetch('https://api.battlemetrics.com/servers?filter[status]=online&filter[game]=rust')
.then(res => res.json())
.then(json => {
    return;
    let servers = json.data.map(s => new Server({
        ip: s.attributes.ip,
        port: s.attributes.port
    }))
    
    console.log(servers)
})
.catch(console.error)

console.log('\n'.repeat(100))
console.clear()

const sv = new Server({
    ip: '200.104.195.197',
    port: 30000,
    debug: true
})

sv.getInfo()
.then(console.log)
sv.getPlayers()
.then(console.log)
sv.getRules()
.then(console.log)