# Features:
* Supports [Multi-packet Response Format](https://developer.valvesoftware.com/wiki/Server_queries#Multi-packet_Response_Format)  
  * Source and GoldSource
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
* Supports IPv6

## Warns: 
* [Bzip decompression](https://developer.valvesoftware.com/wiki/Server_queries#Source_Server) not tested

## Use example:
```js
const { Server } = require('@fabricio-191/valve-server-query');

Server({
    ip: '0.0.0.0',
    port: 27015,
    timeout: 2000
})
  .then(async server => {
    const info = await server.getInfo();
    const players = await server.getPlayers();
    const rules = await server.getRules();

    console.log(info, players, rules);
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
  tv: {
    port: 27020,
    name: 'RaidbossTV'
  },
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

It is usually large, so i do not give an example

## `ping()`

Returns a promise that is resolved in a number (the ping in miliseconds)
This is a deprecated feature of source servers, may not work
The `getInfo` response contains the server ping, so this is not necessary

```js
server.ping()
  .then(ping => {
    console.log(ping); 
  })
  .catch(console.error)
```


## STATIC `getInfo()`
The difference is that it does not require the extra step of connection

Returns a promise that is resolved in an object with the server information, example:
```js
Server.getInfo({
    ip: '0.0.0.0',
    port: 27015,
})
  .then(console.log)
  .catch(console.error);
```

# Other example of use

```js
let server = Server();

server.connect({
    ip: '0.0.0.0',
    port: 27015,
})
  .then(() => {
      console.log('connected');
  })
  .catch(console.error);

//The queries will be delayed until the connection is made, this is handled internally, you don't need to do anything

server.getInfo()
  .then(info => {
    //...
  })
  .catch(console.error);
```