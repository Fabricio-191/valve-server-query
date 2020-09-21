const Server = require('../');
Server.setSocketRef(false);

const fetch = require('./minifetch.js');

fetch(
    'https://api.battlemetrics.com/servers?filter[game]=cs&filter[status]=online&page[size]=100',
    async (err, body, response) => {
        if(err) return console.error('Error at fetching the list of servers');

        let servers;
        try{
            servers = JSON.parse(body.toString()).data
        }catch(e){
            return console.error('Error at fetching the list of servers');
        }
        
        let randomServer = servers[ 
            Math.floor(Math.random() * servers.length) 
        ]

        const sv = new Server({
            ip: randomServer.attributes.ip,
            port: randomServer.attributes.port,
            timeout: 3000
        });

        console.log(randomServer.attributes.ip, randomServer.attributes.port)

        await sv.getInfo()
        .then(console.log)
        .catch(console.error)

        await new Promise(res => setTimeout(res, 4000))
        console.log('\n'.repeat(5))

        await sv.getPlayers()
        .then(console.log)
        .catch(console.error)

        await new Promise(res => setTimeout(res, 4000))
        console.log('\n'.repeat(5))

        await sv.getRules()
        .then(console.log)
        .catch(console.error)
    }
)


