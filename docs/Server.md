# Features:
* Supports [Multi-packet Response Format](https://developer.valvesoftware.com/wiki/Server_queries#Multi-packet_Response_Format)  
  * Source and GoldSource
  * Supports when the multipacket response is goldsource, but the A2S_INFO response is not
* [A2S_INFO](https://developer.valvesoftware.com/wiki/Server_queries#A2S_INFO)
  * Supports [Obsolete GoldSource Response](https://developer.valvesoftware.com/wiki/Server_queries#Obsolete_GoldSource_Response)
* [A2S_PLAYER](https://developer.valvesoftware.com/wiki/Server_queries#A2S_PLAYER)
  * Supports more than 255 players in the same server
* [A2S_RULES](https://developer.valvesoftware.com/wiki/Server_queries#A2S_RULES)
* [A2A_PING](https://developer.valvesoftware.com/wiki/Server_queries#A2A_PING)
  * It's a deprecated feature of source servers
* Supports [A2S_SERVERQUERY_GETCHALLENGE](https://developer.valvesoftware.com/wiki/Server_queries#A2S_SERVERQUERY_GETCHALLENGE)
* Fully supports `The ship`
* Supports Hostnames

## Warns: 
* [Bzip decompression](https://developer.valvesoftware.com/wiki/Server_queries#Source_Server) not tested
* IPv6 not tested
* There are a lot of untested situations

## Use example:
```js
const { Server } = require('@fabricio-191/valve-server-query');
const server = new Server({
    ip: '0.0.0.0',
    port: 27015,
    timeout: 2000
});

server.on('ready', () => {
    //emitted when the server is ready, and you can start doing queries 
    console.log('I am ready!')
})

//if you do a query before the server is ready, it will be delayed until it is ready

server.getInfo()
.then(info => {
    //do something...
})
.catch(console.error)

server.getPlayers()
.then(players => {
    //do something...
})
.catch(console.error)

server.getRules()
.then(rules => {
    //do something...
})
.catch(console.error)
``` 

If the IP entered is not IPv4 or IPv6, it will be treated as a hostname and an attempt will be made to obtain the IP, if the attempt fails, it will throw an error

```js
{
    ip: 'vanilla.rustoria.us', //the only required parameter
    port: 28015, //by default is 27015
    timeout: 3000, //by default is 1000 (1 second)
    debug: true, //by default is false (it shows incoming and outcoming buffers)
}
```

___

## `getInfo()`  
Returns a promise that is resolved in an object with the server information, example:
```js
{
  address: '46.17.43.229:27031',
  ping: 457,
  protocol: 48,
  goldSource: false,
  name: '|͇̿V͇̿I͇̿P͇̿|+hook БЕСПЛАТНО [BIOHAZARD]',
  map: 'de_dust2',
  folder: 'cstrike',
  game: 'Counter-Strike',
  appID: 10,
  players: { online: 2, max: 32, bots: 0 },       
  type: 'dedicated',
  OS: 'linux',
  visibility: 'public',
  VAC: true,
  version: '1.1.2.7/Stdio',
  port: 27031
}
//Properties change depending on the engine used by the server
```


## `getPlayers()`  
Returns a promise that is resolved in an array with the players in the server, example:

```js
[
  {
    index: 0,
    name: 'KoMaToZZzz',
    score: 11,
    timeOnline: {
      hours: 1,
      minutes: 16,
      seconds: 15,
      start: 2020-09-23T00:33:31.197Z
    }
  },
  {
    index: 1,
    name: 'MycoPHbIu BETEP',
    score: 5,
    timeOnline: {
      hours: 0,
      minutes: 53,
      seconds: 20,
      start: 2020-09-23T01:17:20.572Z
    }
  }
]
```

## `getRules()`  
Returns a promise that is resolved in an object with the server rules.
(you should better see it in console, to see what it's)


### Other things:
```js
//instead of 
const server = new Server(options)
//you can do 
const server = Server.init(options)

//these both ^, call the server.connect method inside, if you dont pass options, you need to call the server.connect yourself


const server = Server.init() // || new Server();
//the advantage of this is that you can control when it cannot connect to the server the first time
server.connect({
    ip: '0.0.0.0',
    port: 27015,
    timeout: 2000
})
.then(() => {
	console.log('I am ready!')
	server.disconnect() //not a promise

	return server.connect({
		ip: '0.0.0.2',
		port: 27015,
		timeout: 2000
	})
})
.then(() => {
	console.log('I am ready! 2')
	return server.getInfo();
})
.then(console.log)
.catch(console.error)


//the "getInfo" response contains the server ping, so this is not necessary
server.ping() //deprecated feature of source servers, may not work (it will warn you in console)
.then(ping => {
	console.log(ping); //number
})
.catch(console.error)
```