# valve-server-query

### Implementation of https://developer.valvesoftware.com/wiki/Server_queries 

It is not tested with servers that use pre-2007 engines.

## Use example:
```js
const Server = require('@fabricio-191/valve-server-query');
const server = new Server({
    ip: '0.0.0.0',
    port: 27015
}, 1000);


server.getInfo()
.then(console.log)
.catch(console.error)

server.getPlayers()
.then(console.log)
.catch(console.error)

server.getRules()
.then(console.log)
.catch(console.error)
```

## `class` **Server**
* `getInfo()`  
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


* `getPlayers()`  
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

* `getRules()`  
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