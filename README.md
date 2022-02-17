<a href="https://www.buymeacoffee.com/Fabricio191" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="28" width="135"></a>
[![Discord](https://img.shields.io/discord/555535212461948936?style=for-the-badge&color=7289da)](https://discord.gg/zrESMn6)  

## An implementation of valve protocols

```js
const { Server, RCON, MasterServer } = require('@fabricio-191/valve-server-query');
```

This module allows you to: 
* Easily make queries to servers running valve games
* Make queries to valve master servers
* Use a remote console to control your server remotely

**Some** of the games where it works with are:

* Counter-Strike
* Counter-Strike: Global Offensive
* Garry's Mod
* Half-Life
* Team Fortress 2
* Day of Defeat
* The ship

<details>
<summary>Options</summary>
</br>

These are the default values

```js
{
  ip: 'localhost', //in MasterServer is 'hl2master.steampowered.com'
  port: 27015, //in MasterServer is 27011
  
  timeout: 2000,
  debug: false,
  enableWarns: true,

  //RCON
  password: 'The RCON password', // hasn't a default value
  
  //Master server
  quantity: 200,
  region: 'OTHER',
}
```
</br>
</details>
</br>

# Server

```js
const server = await Server({
  ip: '0.0.0.0',
  port: 27015,
  options: {
    timeout: 3000,
    retries: 5
  }
});

const info = await server.getInfo();
console.log(info);

const players = await server.getPlayers();
console.log(players);

const rules = await server.getRules();
console.log(rules);

const ping = server.lastPing;
console.log(ping);

/*
You can also do:

const [info, players, rules] = await Promise.all([
	server.getInfo(),
	server.getPlayers().catch(e => {}),
	server.getRules().catch(e => {})
]);

This make all queries in parallel
*/
```

<details>
<summary><code>getInfo()</code></summary>
</br>

Performs an [A2S_INFO](https://developer.valvesoftware.com/wiki/Server_queries#A2S_INFO) query to the server

```js
server.getInfo()
  .then(info => {
    console.log(info);
  })
  .catch(err => {
    //...
  });
```

Info can be something like this:

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
  players: { online: 3, max: 10, bots: 0 },
  type: 'dedicated',
  OS: 'linux',
  visibility: 'public',
  VAC: true,
  version: '1.37.6.9',
  //data after this may not be present
  port: 27015,
  steamID: 85568392922144671n,
  tv: {
    port: 27020,
    name: 'RaidbossTV'
  },
  keywords: [
    'empty',     '5v5',
    'boss',    'casual',
    'climb',     'comp',
    'competitive', 'esea',
    'faceit',    'gloves',
    'knife',     'kreedz',
    'kz',      'ladder',
    'priz',    'pub',
    'pug',     'raid',
    'raidboss',  'rank',
    'ranks',     'st'
  ],
  gameID: 730n
}
```
</br>
</details>

<details>
<summary><code>getPlayers()</code></summary>
</br>

Performs an [A2S_PLAYER](https://developer.valvesoftware.com/wiki/Server_queries#A2S_PLAYER) query to get the list of players in the server

Some servers may have disable this query (very rare).

```js
server.getPlayers()
  .then(players => {
    console.log(`There are ${players.length} in the server`);

    const list = players
      .sort((a, b) => b.timeOnline - a.timeOnline)
      .map((player, index) => `${index + 1}. ${player.name} ${player.timeOnline}`)
      .join('\n');

    console.log(list);
  })
  .catch(console.error);
```

> The `time` class has an personalized `toString()` and `@@toPrimitive()` methods

Example:

```js
[
  {
    index: 0,
    name: 'kritikal',
    score: 0,
    timeOnline: Time {
      hours: 0,
      minutes: 10,
      seconds: 25,
      start: 2021-03-20T02:46:28.267Z, //Date
      raw: 625.2186279296875
    }
  },
  {
    index: 0,
    name: 'dmx;',
    score: 0,
    timeOnline: Time {
      hours: 0,
      minutes: 10,
      seconds: 25,
      start: 2021-03-20T02:46:28.267Z,
      raw: 625.0791625976562
    }
  },
  {
    index: 0,
    name: 'fenakz',
    score: 0,
    timeOnline: Time {
      hours: 0,
      minutes: 10,
      seconds: 21,
      start: 2021-03-20T02:46:28.271Z,
      raw: 621.9488525390625
    }
  },
  {
    index: 0,
    name: '[JC] Master-cba',
    score: 0,
    timeOnline: Time {
      hours: 0,
      minutes: 10,
      seconds: 15,
      start: 2021-03-20T02:46:28.278Z,
      raw: 615.4395751953125
    }
  },
  {
    index: 0,
    name: 'sAIONARAH34! [pw] ⚓✵♣',
    score: 1,
    timeOnline: Time {
      hours: 0,
      minutes: 10,
      seconds: 1,
      start: 2021-03-20T02:46:28.292Z,
      raw: 601.7681274414062
    }
  },
  {
    index: 0,
    name: 'INFRA-',
    score: 0,
    timeOnline: Time {
      hours: 0,
      minutes: 9,
      seconds: 50,
      start: 2021-03-20T02:46:28.303Z,
      raw: 590.30859375
    }
  },
  {
    index: 0,
    name: 'Agente86',
    score: 1,
    timeOnline: Time {
      hours: 0,
      minutes: 9,
      seconds: 0,
      start: 2021-03-20T02:46:28.353Z,
      raw: 540.4190063476562
    }
  }
]
```

If the game is `The Ship` every player will have 2 extra properties `deaths` and `money`

</br>
</details>

<details>
<summary><code>getRules()</code></summary>
</br>

Makes an [A2S_RULES](https://developer.valvesoftware.com/wiki/Server_queries#A2S_RULES) query to the server

Some servers may have disable this query, so you should expect an error.

```js
server.getRules()
  .then(console.log)
  .catch(() => {});
```

The response can change a lot between servers

Example:

```js
{
  bot_quota: 0,
  coop: 0,
  cssdm_enabled: 0,
  cssdm_ffa_enabled: 0,
  cssdm_version: '2.1.6-dev',
  deathmatch: 1,
  decalfrequency: 10,
  gungame_enabled: 1,
  metamod_version: '1.10.7-devV',
  mp_allowNPCs: 1,
  mp_autocrosshair: 1,
  mp_autoteambalance: 1,
  mp_c4timer: 35,
  mp_disable_respawn_times: 0,
  mp_fadetoblack: 0,
  mp_falldamage: 0,
  mp_flashlight: 1,
  mp_footsteps: 1,
  mp_forceautoteam: 0,
  mp_forcerespawn: 1,
  mp_fraglimit: 0,
  mp_freezetime: 1,
  mp_friendlyfire: 0,
  mp_holiday_nogifts: 0,
  mp_hostagepenalty: 13,
  mp_limitteams: 2,
  mp_match_end_at_timelimit: 0,
  mp_maxrounds: 0,
  mp_respawnwavetime: 10,
  mp_roundtime: 9,
  mp_scrambleteams_auto: 1,
  mp_scrambleteams_auto_windifference: 2,
  mp_stalemate_enable: 0,
  mp_stalemate_meleeonly: 0,
  mp_startmoney: 800,
  mp_teamlist: 'hgrunt;scientist',
  mp_teamplay: 0,
  mp_timelimit: 18,
  mp_tournament: 0,
  mp_weaponstay: 0,
  mp_winlimit: 0,
  nextlevel: '',
  r_AirboatViewDampenDamp: 1,
  r_AirboatViewDampenFreq: 7,
  r_AirboatViewZHeight: 0,
  r_JeepViewDampenDamp: 1,
  r_JeepViewDampenFreq: 7,
  r_JeepViewZHeight: 10,
  r_VehicleViewDampen: 1,
  scc_version: '2.0.0',
  sm_advertisements_version: 0.6,
  sm_allchat_version: '1.1.1',
  sm_cannounce_version: 1.8,
  sm_ggdm_version: '1.8.0',
  sm_gungamesm_version: '1.2.16.0',
  sm_nextmap: 'gg_toon_poolday',
  sm_noblock: 1,
  sm_playersvotes_version: '1.5.0',
  sm_quakesounds_version: 1.8,
  sm_resetscore_version: '2.6.0',
  sm_show_damage_version: '1.0.7',
  sm_vbping_version: 1.4,
  sourcemod_version: '1.10.0.6482',
  sv_accelerate: 5,
  sv_airaccelerate: 10,
  sv_allowminmodels: 1,
  sv_alltalk: 1,
  sv_bounce: 0,
  sv_cheats: 0,
  sv_competitive_minspec: 0,
  sv_contact: 'linkinaz0@vtr.net',
  sv_enableboost: 0,
  sv_enablebunnyhopping: 0,
  sv_footsteps: 1,
  sv_friction: 4,
  sv_gravity: 800,
  sv_maxspeed: 320,
  sv_maxusrcmdprocessticks: 24,
  sv_noclipaccelerate: 5,
  sv_noclipspeed: 5,
  sv_nostats: 0,
  sv_password: 0,
  sv_pausable: 0,
  sv_rollangle: 0,
  sv_rollspeed: 200,
  sv_specaccelerate: 5,
  sv_specnoclip: 1,
  sv_specspeed: 3,
  sv_steamgroup: '',
  sv_stepsize: 18,
  sv_stopspeed: 75,
  sv_tags: 'alltalk',
  sv_voiceenable: 1,
  sv_vote_quorum_ratio: 0.6,
  sv_wateraccelerate: 10,
  sv_waterfriction: 1,
  tf_arena_max_streak: 3,
  tf_arena_preround_time: 10,
  tf_arena_round_time: 0,
  tf_arena_use_queue: 1,
  tv_enable: 0,
  tv_password: 0,
  tv_relaypassword: 0
  }
```
</br>
</details>

<details>
<summary><code>ping()</code></summary>
</br>

Performs an [A2A_PING](https://developer.valvesoftware.com/wiki/Server_queries#A2A_PING) query into the server



> This is a deprecated feature of source servers, may not work. The `server.lastPing` property contains the server ping, so this is not necessary

A warn in console will be shown (you can disable it by using `{ enableWarns: false }`, see [Options](#options))

It will return `-1` if the server did not respond to the query

```js
server.ping()
  .then(ping => {
    console.log(ping); // 214
  })
  .catch(console.error)
```
</br>
</details>


<details>
<summary><code>disconnect()</code></summary>
</br>

Disconnect the server and destroy the socket

```js
server.disconnect();
```

### Use example

```js
Server(...)
  .then(async server => {
    const players = await server.getPlayers();

    server.disconnect();

    //...
  })
  .catch(console.error);
```

</details>

<details>
<summary><code>static getInfo()</code></summary>
</br>
The difference is that it does not require the extra step of connection

Returns a promise that is resolved in an object with the server information, example:


```js
const { Server } = require('@fabricio-191/valve-server-query');

Server.getInfo({
  ip: '0.0.0.0',
  port: 27015,
})
  .then(console.log)
  .catch(console.error);
```
</details>

</br>

# MasterServer

### Warns: 
* Gold source master servers may not work. The reason is unknown, the servers simply do not respond to queries
* If the quantity is `Infinity` or `'all'`, it will try to get all the servers, but most likely it will end up giving an warning (it will as many servers as possible). The master server stops responding at a certain point.

```js
MasterServer({
  quantity: 1000, // or Infinity or 'all'
  region: 'US_EAST',
  timeout: 3000,
})
  .then(servers => {
    //do something...

    //servers is an array if 'ip:port' strings, see below
  })
  .catch(console.error);
```

### Valid regions are
* US_EAST
* US_WEST
* SOUTH_AMERICA
* EUROPE
* ASIA
* AUSTRALIA
* MIDDLE_EAST
* AFRICA
* OTHER

<details>
<summary><code>Response example</code></summary>

```js
[
  '190.195.150.143:27015', '143.255.142.150:27015', '177.54.144.122:27523',
  '189.1.173.26:27015',  '177.144.128.13:27015',  '177.66.222.92:27015',
  '196.28.69.113:27065',   '144.48.37.119:27015',   '139.180.174.191:27051',
  '108.61.168.31:27050',   '108.61.168.31:27015',   '108.61.168.31:27051',
  '139.180.174.191:27052', '139.180.174.191:27053', '139.99.173.74:27015',
  '45.121.210.91:27550',   '139.99.131.105:27015',  '139.99.144.39:27015',
  '34.87.217.246:27015',   '108.61.227.50:27025',   '108.61.227.12:27035',
  '220.240.1.134:27023',   '221.121.159.236:35240', '221.121.159.236:35260',
  '221.121.159.236:35250', '221.121.149.12:32860',  '121.74.206.225:27015',
  '41.190.141.250:27015',  '111.221.44.137:27018',  '111.221.44.137:27024',
  '111.221.44.137:27023',  '49.245.116.134:27017',  '49.245.116.134:27025',
  '49.245.116.134:27027',  '49.245.116.134:27015',  '49.245.116.134:27016',
  '49.245.116.134:27026',  '223.25.71.43:27015',  '49.245.116.134:27115',
  '49.245.116.134:27118',  '49.245.116.134:27117',  '49.245.116.134:27116',
  '13.229.55.66:24000',  '49.245.116.134:27215',  '103.9.159.78:27065',
  '75.85.184.227:27031',   '75.85.184.227:27034',   '168.235.81.229:27015',
  '66.55.74.111:27015',  '66.55.74.100:27015',  '66.55.74.82:27015',  
  '66.55.74.38:27015',   '66.55.74.103:27015',  '66.55.68.38:27015',  
  '66.55.74.65:27015',   '66.55.74.105:27015',  '66.55.74.104:27015',
  '66.55.68.36:27015',   '66.55.70.53:27015',   '64.111.99.165:27020',
  '66.55.70.177:27115',  '66.55.70.177:27315',  '104.153.109.22:27015',
  '104.153.109.26:27015',  '47.153.235.28:27015',   '173.199.84.186:27015',
  '64.190.203.117:27015',  '103.214.108.12:27105',  '173.199.87.235:27025',
  '8.3.6.148:27015',     '66.75.2.253:27015',   '172.107.198.173:27075',
  '172.107.2.177:27035',   '198.12.71.30:27015',  '206.251.72.62:27017',
  '104.207.148.159:27045', '92.38.148.25:27015',  '159.89.142.219:27016',
  '159.89.142.219:27015',  '159.89.142.219:27017',  '74.91.118.231:27015',
  '108.61.124.77:27065',   '192.53.126.95:27015',   '108.61.124.78:27980',
  '108.61.235.138:27015',  '108.61.124.72:27045',   '104.206.244.2:19001',
  '198.24.171.83:27185',   '131.153.29.243:27035',  '173.27.92.73:27016',
  '162.248.90.33:27015',   '162.248.90.38:27015',   '162.248.90.19:27015',
  '66.58.130.164:27015',   '71.193.199.206:27015',  '71.193.199.206:27017',
  '54.202.134.208:27015',  '64.42.176.58:27015',  '104.192.227.146:17741',
  '74.201.72.18:27015',
  ...1051 more items
]
```
</details>

<details>
<summary><code>filter</code></summary>

```js
MasterServer({
	filter: {
		nor: {
			flags: ['secure']
		}
		flags: ['dedicated']
		map: 'cs_italy',
	}
})
  .then(console.log)
  .catch(console.error)

// Will return a list of ips that are dedicated servers, in the cs_italy map and that do not have an anti-cheat enabled
```

See https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Filter

Properties of the filter object:

| Parameter          | Values  | Description                                                                   |
| ------------------ | ------- | ----------------------------------------------------------------------------- |
| name_match         | string  | Servers with their hostname matching that hostname (can use * as a wildcard)  |
| version_match      | string  | Servers running version that version (can use * as a wildcard)                |
| gameaddr           | string  | Return only servers on the specified IP address (port supported and optional) |
| gamedir            | string  | Servers running the specified modification (ex. cstrike)                      |
| map                | string  | Servers running the specified map (ex. cs_italy)                              |
| appid              | number  | Servers that are running game with that [appid](https://developer.valvesoftware.com/wiki/Steam_Application_IDs) |
| napp               | number  | Servers that are NOT running game with that [appid](https://developer.valvesoftware.com/wiki/Steam_Application_IDs) |
| nor                | filter  | Another filter object, specifies that servers matching **any** of the conditions should in that filter should not be returned |
| nand               | filter  | Another filter object, specifies that servers matching **all** of the conditions should in that filter should not be returned |
| gametype           | array   | Servers with all of the given tag(s) in sv_tags                               |
| gamedata           | array   | Servers with all of the given tag(s) in their 'hidden' tags (only in L4D2)    |
| gamedataor         | array   | Servers with any of the given tag(s) in their 'hidden' tags (only in L4D2)    |
| flags              | array   | See below                                                                     |

Notes: 
* all array's are of strings.
* `flags` are not booleans. if you want to get the inverse of any of these flags, you should use `nor` or `nand`.

Flags

| Name       | Description                             |
| ---------- | --------------------------------------- |
| dedicated  | Servers that are dedicated servers      |
| secure     | Servers using anti-cheat technology (VAC, but potentially others as well) |
| linux      | Servers running on a Linux platform     |
| password   | Servers that are not password protected |
| noplayers  | Servers that are empty                  |
| empty      | Servers that are not empty              |
| full       | Servers that are not full               |
| proxy      | Servers that are spectator proxies      |
| white      | Servers that are whitelisted            |
| collapse_addr_hash | Return only one server for each unique IP address matched |

</details>

<details>
<summary><code>getIPS()</code></summary>

```js
MasterServer.getIPS()
  .then(console.log)
  .catch(console.error)

/*
Returns an object with the master servers ips, like this: 
{
  goldSource: [ '208.64.200.118', '208.64.200.117' ],  
  source: [ '208.64.200.65', '208.64.200.39', '208.64.200.52' ]
}
*/
```

See https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Master_servers

> The port used in `hl2master.steampowered.com` (source) ip's is `27011` but one of them is using a different port: `27015`  
> The port numbers used by `hl1master.steampowered.com` (goldSource) can be anything between `27010` and `27013`.
</details>

</br>

# RCON

Some commands will cause the server to disconnect, for example `sv_gravity 0` in some cases or `rcon_password newPassword` as it changes de password and needs to authenticate again.

[Commands list](https://developer.valvesoftware.com/wiki/Console_Command_List) 

```js
const rcon = await RCON({
  ip: '0.0.0.0',
  port: 27015, //RCON port
  password: 'your RCON password'
});

rcon.on('disconnect', async (reason) => {
	console.log('disconnected', reason);
	try{
		await rcon.reconnect();
	}catch(e){
		console.log('reconnect failed', e.message);
	}
});

rcon.on('passwordChanged', async () => {
	const password = await getNewPasswordSomehow();
	try{
		await rcon.authenticate(password);
	}catch(e){
		console.error('Failed to authenticate with new password', e.message);
	}
});

const response = await rcon.exec('sv_gravity 1000');
// Response is always a string that is some kind of log of the server or it can be empty
```

<details>
<summary><code>exec(command)</code></summary>

This will work well with `server.getRules()`
```js
// gravity will change randomly every 5 seconds

setInterval(() => {
  const value = Math.floor(Math.random() * 10000) - 3000;
  //value will be a number between -3000 and 6999

  rcon.exec(`sv_gravity ${value}`)
    .catch(console.error);

}, 5000);
```
</details>


<details>
<summary><code>destroy()</code></summary>

Destroys the RCON connection, this will not fire the `disconnect` event

```js
rcon.destroy();
```
</details>