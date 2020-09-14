const Server = require('../')
const sv = new Server({
    address: "164.132.207.129",
    port: 28065
})

sv.get()
.then(console.log)
.catch(console.error)