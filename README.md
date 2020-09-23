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
* [A2A_PING](https://developer.valvesoftware.com/wiki/Server_queries#A2A_PING)
  * It's a deprecated feature of source servers
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
    port: 27015,
    timeout: 2000
});

server.on('ready', () => {
    //emitted when the server is ready, and you can start doing queries 
    console.log('I am ready!')
})

//if you do a query before the server is ready, it will be delayed until it is ready
//the maximum time for the server to be ready is the "timeout" you set, multiplied by 1.333 (a 33% more)

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
(more things at the end of the page)

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
  players: { online: 11, max: 32, bots: 0 },       
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
      hours: 731,
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
Returns a promise that is resolved in an object with the server rules, example:

```js
{
  allow_spectators: 1,
  amx_client_languages: 1,
  amx_language: 'ru',
  amx_nextmap: 'de_dust2',
  amx_timeleft: '02:42',
  amxmodx_version: '1.9.0.5271',
  coop: 0,
  deathmatch: 1,
  decalfrequency: 30,
  edgefriction: 2,
  ff_damage_reduction_bullets: 0.35,
  ff_damage_reduction_grenade: 0.25,
  ff_damage_reduction_grenade_self: 1,
  ff_damage_reduction_other: 0.35,
  game_version: '5.18.0.474-dev',
  humans_join_team: 'any',
  max_queries_sec: 1,
  max_queries_sec_global: 1,
  max_queries_window: 1,
  metamod_version: '1.3.0.128',
  mp_afk_bomb_drop_time: 0,
  mp_autokick: 0,
  mp_autokick_timeout: -1,
  mp_autoteambalance: 1,
  mp_buy_anywhere: 0,
  mp_buytime: 0.25,
  mp_c4timer: 45,
  mp_chattime: 10,
  mp_consistency: 1,
  mp_fadetoblack: 0,
  mp_falldamage: 1,
  mp_flashlight: 1,
  mp_footsteps: 1,
  mp_forcecamera: 0,
  mp_forcechasecam: 0,
  mp_forcerespawn: 0,
  mp_fraglimit: 0,
  mp_fragsleft: 0,
  mp_freeforall: 0,
  mp_freezetime: 0,
  mp_friendlyfire: 0,
  mp_give_player_c4: 1,
  mp_hostage_hurtable: 1,
  mp_hostagepenalty: 13,
  mp_infinite_ammo: 0,
  mp_infinite_grenades: 0,
  mp_item_staytime: 300,
  mp_kickpercent: 0.66,
  mp_limitteams: 2,
  mp_logdetail: 3,
  mp_logfile: 1,
  mp_logmessages: 1,
  mp_mapvoteratio: 0.66,
  mp_maxmoney: 16000,
  mp_maxrounds: 0,
  mp_mirrordamage: 0,
  mp_playerid: 0,
  mp_radio_maxinround: 60,
  mp_radio_timeout: 1.5,
  mp_respawn_immunity_effects: 1,
  mp_respawn_immunity_force_unset: 1,
  mp_respawn_immunitytime: 0,
  mp_round_infinite: 0,
  mp_round_restart_delay: 5,
  mp_roundover: 0,
  mp_roundtime: 4,
  mp_scoreboard_showdefkit: 1,
  mp_scoreboard_showhealth: 3,
  mp_scoreboard_showmoney: 3,
  mp_show_scenarioicon: 0,
  mp_startmoney: 800,
  mp_timeleft: '02:41',
  mp_timelimit: 20,
  mp_tkpunish: 0,
  mp_weapons_allow_map_placed: 1,
  mp_windifference: 1,
  mp_winlimit: 0,
  pausable: 0,
  reu_version: '0.1.0.92c',
  revoice_version: '0.1.0.34',
  sv_accelerate: 5,
  sv_aim: 0,
  sv_airaccelerate: 10,
  sv_allowupload: 0,
  sv_alltalk: 0,
  sv_bounce: 1,
  sv_cheats: 0,
  sv_clienttrace: 1,
  sv_contact: '',
  sv_friction: 4,
  sv_gravity: 800,
  sv_logblocks: 0,
  sv_maxrate: 20000,
  sv_maxspeed: 900,
  sv_minrate: 0,
  sv_password: 0,
  sv_proxies: 1,
  sv_restart: 0,
  sv_restartround: 0,
  sv_stepsize: 18,
  sv_stopspeed: 75,
  sv_uploadmax: 0.5,
  sv_version: '1.1.2.7/Stdio,48,2228',
  sv_voiceenable: 1,
  sv_wateraccelerate: 10,
  sv_waterfriction: 1,
  yb_version: '4.0.0.449'
} //Rules can change a lot depending on the game an the server
```

### Other things:
```js
Server.setSocketRef(false); //the socket will not keep the node.js process alive


//instead of 
const server = new Server(options)
//you can do 
const server = Server.init(options)

//these both ^, call the server.connect method inside, if you dont pass options, you need to call the server.connect yourself


const server = Server.init()
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