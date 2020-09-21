const Server = require('../');

const sv2 = new Server({
    ip: '45.235.98.69',
    port: 27020,
    debug: true
});

(async function(){
    await sv2.getInfo()
    .then(console.log)
    .catch(console.error)

    await new Promise(res => setTimeout(res, 4000))
    console.log('\n'.repeat(5))

    await sv2.getPlayers()
    .then(console.log)
    .catch(console.error)

    await new Promise(res => setTimeout(res, 4000))
    console.log('\n'.repeat(5))

    await sv2.getRules()
    .then(console.log)
    .catch(console.error)
})();

Server.setSocketRef(false);