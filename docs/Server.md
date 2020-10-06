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
    timeout: 3000, //by default is 2000 (2 seconds)
    debug: true, //by default is false (it shows incoming and outcoming buffers)
}
```

___

## `getInfo()`  
Returns a promise that is resolved in an object with the server information, example:
```js
{
  address: '192.223.30.25:27015',
  ping: 222,
  protocol: 17,
  goldSource: false,
  name: '[Raidboss] Private KZ/Climb [GOKZ |Global | VIP/Whitelist Only]',
  map: 'kz_frozen_go',
  folder: 'csgo',
  game: 'Counter-Strike: Global Offensive',
  appID: 730n,
  players: { online: 3, max: 10, bots: 3 },
  type: 'dedicated',
  OS: 'linux',
  visibility: 'public',
  VAC: true,
  version: '1.37.6.9',
  port: 27015,
  steamID: 85568392922144671n,
  'tv-port': 27020,
  'tv-name': 'RaidbossTV',
  keywords: [
    'empty',       '5v5',
    'boss',        'casual',
    'climb',       'comp',
    'competitive', 'esea',
    'faceit',      'gloves',
    'knife',       'kreedz',
    'kz',          'ladder',
    'priz',        'pub',
    'pug',         'raid',
    'raidboss',    'rank',
    'ranks',       'st'
  ],
  gameID: 730n
}
```

## `getPlayers()`  
Returns a promise that is resolved in an array with the players in the server, example:
```js
[
  {
    index: 0,
    name: 'RaidbossTV',
    score: 0,
    timeOnline: {
      hours: 1,
      minutes: 21,
      seconds: 17,
      start: 2020-10-06T02:03:29.520Z,
      raw: 4877.6787109375
    }
  },
  {
    index: 0,
    name: '1',
    score: 0,
    timeOnline: {
      hours: 1,
      minutes: 21,
      seconds: 17,
      start: 2020-10-06T02:03:29.520Z,
      raw: 4877.6787109375
    }
  },
  {
    index: 0,
    name: '2',
    score: 0,
    timeOnline: {
      hours: 1,
      minutes: 21,
      seconds: 17,
      start: 2020-10-06T02:03:29.520Z,
      raw: 4877.6787109375
    }
  }
]
```

## `getRules()`  
Returns a promise that is resolved in an object with the server rules.
(you should better see it in console, to see what it's)

It is usually large, so I do not give an example

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