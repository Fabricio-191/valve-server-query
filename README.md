# **valve-server-query**

[![GitHub license](https://img.shields.io/github/license/Fabricio-191/valve-server-query?color=white&style=for-the-badge)](https://github.com/Fabricio-191/valve-server-query/blob/master/LICENSE)
[![Issues](https://img.shields.io/github/issues/Fabricio-191/valve-server-query?style=for-the-badge)](https://github.com/Fabricio-191/valve-server-query/issues)


### Implementation of [Valve server queries](https://developer.valvesoftware.com/wiki/Server_queries)

Bzip decompression function was taken from https://www.npmjs.com/package/bz2

### Features:
* Supports [Multi-packet Response Format](https://developer.valvesoftware.com/wiki/Server_queries#Multi-packet_Response_Format)  
  * Source and GoldSource
  * Supports when the multipacket response is goldsource, but the A2S_INFO response is not
* [A2S_INFO](https://developer.valvesoftware.com/wiki/Server_queries#A2S_INFO)
  * Supports [Obsolete GoldSource Response](https://developer.valvesoftware.com/wiki/Server_queries#Obsolete_GoldSource_Response)
* [A2S_PLAYER](https://developer.valvesoftware.com/wiki/Server_queries#A2S_PLAYER)
  * Supports more than 255 players in the same server
* [A2S_RULES](https://developer.valvesoftware.com/wiki/Server_queries#A2S_RULES)
* Supports [A2S_SERVERQUERY_GETCHALLENGE](https://developer.valvesoftware.com/wiki/Server_queries#A2S_SERVERQUERY_GETCHALLENGE)
* Fully supports `The ship`
* Supports Hostnames

#### Warns: 
* [Bzip decompression](https://developer.valvesoftware.com/wiki/Server_queries#Source_Server) not tested
* IPv6 not tested
* There are a lot of untested situations

> If you have any error you can contact me on [Discord](https://discord.gg/zrESMn6) or [GitHub](https://github.com/Fabricio-191/valve-server-query/issues) (i prefer Discord)

## Use example:
```js
const Server = require('@fabricio-191/valve-server-query');
const server = new Server({
    ip: '0.0.0.0',
    port: 28015,
    timeout: 3000
});

server.on('ready', () => {
  console.log('I am ready!')
})

server.getInfo()
.then(info => {
    console.log(info);
    //do something...
})
.catch(console.error)

server.getPlayers()
.then(players => {
    console.log(players);
    //do something...
})
.catch(console.error)

server.getRules()
.then(rules => {
    console.log(rules);
    //do something...
})
.catch(console.error)

Server.setSocketRef(false); //the socket will not keep the node.js process alive
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
  protocol: 17,
  name: 'Paint Gaming [PCW/MIX/MULTIMOD] |By Garryshost|',
  map: '$2000$',
  folder: 'cstrike',
  game: 'Counter-Strike: Source',
  appID: 240,
  players: { online: 2, max: 16, bots: 0 },
  type: 'dedicated',
  OS: 'windows',
  visibility: 'public',
  VAC: true,
  version: '5394425',
  port: 27055,
  steamID: 90136332711713797n,
  keywords: [ 'alltalk', 'startmoney' ],
  gameID: 240n,
  ping: 204
}
//Properties change depending on the engine used by the server
```


## `getPlayers()`  
Returns a promise that is resolved in an array with the players in the server, example:

```js
[
  {
    index: 0,
    name: 'Ethan35',
    score: 4,
    timeOnline: {
      hours: 0,
      minutes: 26,
      seconds: 23,
      start: 2020-06-17T21:57:49.537Z //Date object
    }
  },
  {
    index: 0,
    name: 'Grimmsoka',
    score: 11,
    timeOnline: {
      hours: 0,
      minutes: 4,
      seconds: 47,
      start: 2020-06-17T21:57:50.833Z //Date object
    }
  }
]
```

## `getRules()`  
Returns a promise that is resolved in an object with the server rules, example:

```js
{
  coop: 0,
  cssdm_version: '2.1.6-dev',
  custom_chat_colors_version: '3.1.0',
  deathmatch: 1,
  decalfrequency: 10,
  es_corelib_ver: '2.1.1.336',
  eventscripts_ver: '2.1.1.379',
  mattie_eventscripts: 1,
  mc_version: '1.1.1',
  metamod_version: '1.10.7-devV',
  mp_allowNPCs: 1,
  mp_autocrosshair: 1,
  mp_autoteambalance: 1,
  mp_c4timer: 35,
  mp_falldamage: 0,
  mp_flashlight: 1,
  mp_footsteps: 1,
  mp_forceautoteam: 0,
  mp_forcerespawn: 1,
  mp_fraglimit: 0,
  mp_freezetime: 2,
  mp_friendlyfire: 0,
  mp_holiday_nogifts: 0,
  mp_hostagepenalty: 5,
  mp_limitteams: 2,
  mp_match_end_at_timelimit: 0,
  mp_maxrounds: 100,
  mp_respawnwavetime: 10,
  mp_roundtime: 2,
  mp_startmoney: 3000,
  mp_timelimit: 40,
  mp_winlimit: 50
} //It usually shows a lot more of rules, this is a sample only
```