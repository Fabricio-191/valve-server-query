<style>
details summary {
   font-size: 15px;
}
</style>

[![Issues](https://img.shields.io/github/issues/Fabricio-191/valve-server-query?style=for-the-badge)](https://github.com/Fabricio-191/valve-server-query/issues)
[![Donate](https://img.shields.io/badge/donate-patreon-F96854.svg?style=for-the-badge)](https://www.patreon.com/fabricio_191)
[![Discord](https://img.shields.io/discord/555535212461948936?style=for-the-badge&color=7289da)](https://discord.gg/zrESMn6)  
<!--
[![License](https://img.shields.io/github/license/Fabricio-191/valve-server-query?color=white&style=for-the-badge)](https://github.com/Fabricio-191/valve-server-query/blob/master/LICENSE)
[![NPM](https://nodei.co/npm/@fabricio-191/valve-server-query.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/@fabricio-191/valve-server-query)
-->
## An implementation of valve protocols

```js
const { Server, RCON, MasterServer } = require('@fabricio-191/valve-server-query');
```

This module allows you to: 
* Easily make queries to servers running valve games
* Make queries to valve master servers
* Use a remote console to control your server remotely

**Some** of the games where it works with are:

* Counter-Strike: Global Offensive
* Garry's Mod
* Half-Life
* Team Fortress 2
* Counter-String
* Day of Defeat
* The ship

</br>

# Server

```js
Server({
	ip: '0.0.0.0',
	port: 27015,
	timeout: 2000
})
	.then(server => {
		//...
	})
	.catch(err => {
		//error while connecting 
		//server may: never existed/offline/didn't respond to queries
	});
```
<details>
<summary><code>getInfo()</code></summary>

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
	ping: 222, //i think ping is not working well
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
	//data after this may not be present
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
</details>

<details>
<summary><code>getPlayers()</code></summary>

Performs an [A2S_PLAYER](https://developer.valvesoftware.com/wiki/Server_queries#A2S_PLAYER) query to get the list of players in the server

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

> The `time` class has an personalized `toString()` and `@@toPrimitive` methods

</details>

<details>
<summary><code>getRules()</code></summary>

Makes an [A2S_RULES](https://developer.valvesoftware.com/wiki/Server_queries#A2S_RULES) query to the server

(this changes a lot between servers)

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
</details>

<details>
<summary><code>ping()</code></summary>

Performs an [A2A_PING](https://developer.valvesoftware.com/wiki/Server_queries#A2A_PING) query into the server

The `getInfo` response contains the server ping, so this is not necessary

> This is a deprecated feature of source servers, may not work

A warn in console will be shown (you can disable it by using `{ enableWarns: false }`, see [below](#options))

```js
server.ping()
	.then(ping => {
		console.log(ping); // 214
	})
	.catch(console.error)
```
</details>


<details>
<summary><code>static getInfo()</code></summary>
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

<br/>

# MasterServer

Later i will add the 'filter' to the options

## Warns: 
* If the quantity is `Infinity` or `'all'`, it will try to get all the servers, but most likely it will end up giving an warning. The master server stops responding at a certain point
* Gold source master servers may not work. The reason is unknown, the servers simply do not respond to queries

```js
MasterServer({
    timeout: 3000,
    quantity: 1000,
    region: 'US_EAST',
})
    .then(servers => {
        //do something...

		//servers is an array if 'ip:port' strings, see below
    });
    .catch(console.error)
```
<details>
<summary><code>Response example</code></summary>

```js
[
  '45.225.92.87:27015',    '186.183.88.7:27015',    '200.35.158.178:27050',
  '200.35.158.178:27060',  '200.35.158.117:27000',  '200.35.158.117:29988',
  '200.35.158.117:29005',  '200.35.158.117:27050',  '200.35.158.117:29000',
  '190.171.168.35:27020',  '201.238.240.242:26915', '201.238.240.242:27219',
  '201.238.240.242:27206', '201.238.240.242:27220', '201.238.240.242:27203',
  '201.238.240.242:27218', '201.238.240.242:27208', '201.238.240.242:27212',
  '201.238.240.242:27209', '201.238.240.242:27210', '201.238.240.242:26914',
  '201.238.240.242:27213', '201.238.240.242:27204', '201.238.240.242:27202',
  '201.238.240.242:26912', '131.221.35.11:27046',   '131.221.35.11:27019',
  '131.221.35.11:27044',   '201.238.240.242:27205', '201.238.240.242:27214',
  '201.238.240.242:27217', '131.221.35.11:27030',   '131.221.35.11:27016',
  '201.238.240.242:27207', '201.238.240.242:27216', '201.238.240.242:26911',
  '201.238.240.242:27215', '201.238.240.242:26913', '201.238.240.242:27201',
  '201.238.240.242:27211', '190.171.168.35:27015',  '131.221.35.11:27022',
  '131.221.35.11:27040',   '131.221.35.11:27020',   '131.221.35.11:27018',
  '131.221.35.11:27026',   '131.221.35.11:27021',   '190.82.221.47:27015',
  '186.109.136.89:27015',  '131.196.2.210:27017',   '131.196.2.210:27019',
  '131.196.2.210:27025',   '190.177.84.35:27016',   '190.112.7.116:27015',
  '200.42.69.26:27015',    '186.61.108.56:27020',   '186.61.108.56:27022',
  '186.61.108.56:27021',   '186.61.108.56:27029',   '186.61.108.56:27026',
  '186.61.108.56:27030',   '45.235.98.243:27050',   '45.235.98.241:27037',
  '45.235.98.252:27065',   '45.235.98.241:27036',   '45.235.98.242:27053',
  '45.235.99.202:27100',   '45.235.98.239:27030',   '45.235.98.242:27030',
  '45.235.98.164:27019',   '45.235.98.242:27051',   '45.235.98.240:27040',
  '45.235.98.243:27045',   '190.210.8.69:27015',    '45.235.99.134:27055',
  '45.235.98.239:27040',   '45.235.98.242:27031',   '45.235.99.174:27165',
  '45.235.98.239:27050',   '45.235.98.241:27045',   '45.235.98.241:27035',
  '45.235.98.244:27057',   '45.235.98.244:27040',   '45.235.98.244:27055',
  '45.235.98.244:27056',   '45.235.98.91:27087',    '181.116.16.170:27015',
  '200.85.158.120:27015',  '190.106.146.106:27015', '190.106.146.106:27016',
  '160.20.247.46:30009',   '160.20.247.73:20008',   '160.20.247.69:20009',
  '45.235.98.240:27035',   '45.235.98.241:27029',   '45.235.99.134:27070',
  '45.235.98.252:27016',   '45.235.98.239:27090',   '45.235.98.240:27075',
  '168.195.130.13:20003',
  ...131 more items
]
```
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

<br/>

# RCON

## Warns: 
* Executting `cvarlist` or `status` may interfere with other queries and it can throw an incomplete output (the cvarlist command above all)
* Some commands may cause an server-side error (`sv_gravity 0` for example) and the connection will be ended (will show a warn in console), but the module is going to attempt to reconnect

```js
RCON({
    ip: '0.0.0.0',
    port: 27015, //RCON port
    password: 'your RCON password',
	options: {
		timeout: 2000,
	}
})
    .then(rcon => {
		rcon.exec('sv_gravity 1000')
			.catch(err => {
				// error executing the command
			});

		rcon.cli.enable(); //now you can execute commands in console
	})
    .catch(err => {
		//error while connecting
	})
``` 

<details>
<summary><code>exec(command)</code></summary>

This will work well with `server.getRules()`
```js
setInterval(() => {
	const value = Math.floor(Math.random() * 10000) - 3000;
	//value will be a number between -3000 and 6999

	rcon.exec(`sv_gravity ${value}`)
		.catch(console.error);

	//gravity will change randomly every 5 seconds
}, 5000);
```
</details>


<details>
<summary><code>authenticate(password)</code></summary>

```js

```
</details>

<details>
<summary><code>cli</code></summary>

```js
rcon.cli.enable();

rcon.cli.disable();
```
</details>

</br>

# Options

These are the detault values

```js
{
    ip: 'localhost', //in MasterServer is 'hl2master.steampowered.com'
    port: 27015, //in MasterServer is 27011
	options: {
		timeout: 2000,
		debug: false,
		enableWarns: true,
		retries: 3,

		//Master server
		quantity: 200,
		region: 'OTHER',
	},
    //RCON
    password: 'The RCON password', // hasn't a default value
}
```

Also: all options can be outside the options object (like in [MasterServer](#masterserver) example)