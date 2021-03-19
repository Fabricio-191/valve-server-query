<style>
details summary {
   font-size: 23px;
}

</style>

<!-- [![License](https://img.shields.io/github/license/Fabricio-191/valve-server-query?color=white&style=for-the-badge)](https://github.com/Fabricio-191/valve-server-query/blob/master/LICENSE) -->
[![Issues](https://img.shields.io/github/issues/Fabricio-191/valve-server-query?style=for-the-badge)](https://github.com/Fabricio-191/valve-server-query/issues)
[![Donate](https://img.shields.io/badge/donate-patreon-F96854.svg?style=for-the-badge)](https://www.patreon.com/fabricio_191)
[![Discord](https://img.shields.io/discord/555535212461948936?style=for-the-badge&color=7289da)](https://discord.gg/zrESMn6)  
[![NPM](https://nodei.co/npm/@fabricio-191/valve-server-query.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/@fabricio-191/valve-server-query)
# Implementation of valve protocols

<!--The empty html-comments are to allow pledge when editing the code inside <detals> tags--> 

```js
const { Server, RCON, MasterServer } = require('@fabricio-191/valve-server-query');
```

* [Server]()
	* [getInfo]()
	* [getPlayers]()
	* [getRules]()
	* [ping]()
	* [disconnect]()
	* static [getInfo]()
* [MasterServer]()
	* static [getIPs]()
* [RCON]()
	* [exec]()
	* [destroy]()
	* [cli]()

<details>
	<summary>Server</summary>	
	<p>	
	### Use example:
	```js
	const { Server } = require('@fabricio-191/valve-server-query');
<!---->
	Server({
		ip: '0.0.0.0',
		port: 27015,
		timeout: 2000
	})
		.then(async server => {
			const info = await server.getInfo();
			const players = await server.getPlayers();
			const rules = await server.getRules();
<!---->
			//You could re-write that to this:
			const [info, players, rules] = await Promise.all([ 
				server.getInfo(), 
				server.getPlayers(), 
				server.getRules() 
			]);
			//The advantage is that all request are made at the same time
<!---->
			console.log(info, players, rules);
		})
		.catch(console.error)
<!---->
	``` 
<!---->
	## Methods
	___
<!---->
	### `getInfo()`  
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
<!---->
	### `getPlayers()`  
	Returns a promise that is resolved in an array with the players in the server, example:
	```js
	[
		{
			index: 0,
			name: 'some name',
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
			name: 'some other name',
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
			name: 'xd',
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
<!---->
	### `getRules()`  
	Returns a promise that is resolved in an object with the server rules.
	(you should better see it in console, to see what it's)
<!---->
	It is usually large, so i do not give an example
<!---->
	### `ping()`
<!---->
	Returns a promise that is resolved in a number (the ping in miliseconds)
	This is a deprecated feature of source servers, may not work
	The `getInfo` response contains the server ping, so this is not necessary
<!---->
	```js
	server.ping()
		.then(console.log)
		.catch(console.error)
	```
<!---->
	### `static getInfo()`
	The difference is that it does not require the extra step of connection
<!---->
	Returns a promise that is resolved in an object with the server information, example:
	```js
	const { Server } = require('@fabricio-191/valve-server-query');
<!---->
	Server.getInfo({
		ip: '0.0.0.0',
		port: 27015,
	})
		.then(console.log)
		.catch(console.error);
	```
<!---->
	## Other example of use
<!---->
	```js
	const server = Server();
<!---->
	server.connect({
		ip: '0.0.0.0',
		port: 27015,
	})
		.then(() => {
			console.log('connected');
		})
		.catch(console.error);
<!---->
	//The queries will be delayed until the connection is made, this is handled internally, you don't need to do anything
<!---->
	server.getInfo()
		.then(info => {
			//...
		})
		.catch(console.error);
	```
</details>

<details>
  	<summary>MasterServer</summary>
  	<p>
## Warns: 
* Filters has been disabled
* If the quantity is `Infinity` or `'all'`, it will try to get all the servers, but most likely it will end up giving an warning.  
  The master server stops responding at a certain point
* Gold source master servers may not work  
  The reason is unknown, the servers simply do not respond to queries
<!---->
## Use example:
```js
const { MasterServer } = require('@fabricio-191/valve-server-query');
<!---->
MasterServer({
    timeout: 3000,
    quantity: 1000,
    region: 'US_EAST',
})
    .then(servers => {
        //do something...
<!---->
        //example:
        /*
        [
            '168.232.165.202:27015', '45.236.130.91:27015',   '190.189.114.9:27016',   
            '168.205.176.194:27015', '143.255.142.150:27015', '191.233.193.227:27008', 
            '191.233.193.227:27004', '191.233.193.227:27006', '189.1.172.194:27165',   
            '189.1.172.194:27295',   '177.54.148.234:27410',  '191.252.60.108:27016',  
            '177.71.197.102:27015',  '35.198.11.203:27015',   '35.215.242.218:27015',  
            '177.144.128.13:27015',  '45.179.88.129:27015',   '45.179.88.191:27015',   
            '196.41.143.12:27015',   '197.91.135.85:27016',   '197.91.135.85:27015',   
            '169.1.39.6:27015',      '169.1.39.6:27025',      '102.132.150.129:27007', 
            '197.218.143.86:27015',  '197.218.143.86:27016',  '41.151.29.171:27015',   
            '139.180.174.191:27050', '139.180.174.191:27053', '139.180.174.191:27052', 
            '139.180.174.191:27051', '106.68.215.192:27023',  '144.48.37.119:27015',   
            '61.69.243.209:27015',   '59.167.251.107:27815',  '220.238.70.245:27015',  
            '108.61.168.31:27051',   '108.61.168.31:27050',   '149.28.183.45:27050',   
            '149.28.183.45:27051',   '108.61.168.31:27015',   '103.1.206.211:27035',   
            '139.99.155.23:27015',   '139.99.134.181:27015',  '139.99.144.52:27020',   
            '139.99.144.52:27025',   '45.121.211.230:27400',  '149.28.176.253:27016',  
            '45.121.210.91:27550',   '13.55.35.65:27015',     '45.121.211.218:27410',  
            '149.28.175.99:27015',   '221.121.149.12:32861',  '221.121.149.12:32860',  
            '103.70.192.38:27015',   '124.197.46.37:27015',   '41.190.141.233:27015',  
            '41.190.141.250:27015',  '111.221.44.137:27024',  '111.221.44.137:27029',  
            '111.221.44.137:27018',  '111.221.44.137:27023',  '112.199.151.207:27016', 
            '112.199.151.207:27027', '112.199.151.207:27026', '112.199.151.207:27015', 
            '112.199.151.207:27025', '112.199.151.207:27017', '112.199.151.207:27115', 
            '51.79.162.111:27015',   '112.199.151.207:27116', '35.247.153.169:27017',  
            '112.199.151.207:27118', '112.199.151.207:27117', '112.199.151.207:27215', 
            '103.9.159.78:27155',    '103.9.159.78:27105',    '103.9.159.78:27125',    
            '103.9.159.78:27065',    '103.9.159.78:27075',    '103.9.159.78:27085',    
            '103.9.159.78:27165',    '103.9.159.78:27115',    '172.91.143.107:27015',  
            '8.3.6.148:27015',       '172.107.236.46:27084',  '172.86.64.121:27019',   
            '103.214.108.12:27105',  '173.199.87.235:27025',  '173.199.84.186:27015',  
            '66.55.70.177:27115',    '66.55.70.177:27315',    '66.55.74.59:27015',     
            '66.55.74.28:27015',     '66.55.74.37:27015',     '66.55.74.112:27015',    
            '66.55.74.103:27015',    '66.55.68.41:27015',     '66.55.70.58:27015',     
            '172.107.2.177:27035',
            ... 3893 more items
        ]
        */
    })
    .catch(console.error)
```
<!---->
## Options:
<!---->
<!---->
## Other: 
<!---->
```js
MasterServer.getIPS()
    .then(console.log)
    .catch(console.error)
<!---->
/*
Returns an object with the master servers ips, like this: 
{
  goldSource: [ '208.64.200.118', '208.64.200.117' ],    
  source: [ '208.64.200.65', '208.64.200.39', '208.64.200.52' ]
}
*/
```
<!---->
See https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Master_servers
<!---->
> The port used in `hl2master.steampowered.com` ip's is `27011` but one of them is using a different port: `27015`  
> The port numbers used by `hl1master.steampowered.com` can be anything between `27010` and `27013`.
	</p>
</details>

<details><summary>RCON</summary>
<p>
# Features:
* Supports [Multi-packet Response Format](https://developer.valvesoftware.com/wiki/Source_RCON_Protocol#Multiple-packet_Responses) (this actually pissed me)
<!---->
## Warns: 
* Executting `cvarlist` or `status` may interfere with other queries and it can throw an incomplete output (the cvarlist command above all)
* Some commands may cause an server-side error (`sv_gravity 0` for example) and the connection will be ended (will show a warn in console), but the module is going to attempt to reconnect
<!---->
## Use example:
```js
const { RCON } = require('@fabricio-191/valve-server-query');
<!---->
RCON({
    ip: '0.0.0.0',
    port: 27015, //RCON port
    password: 'your RCON password',
	options: {
		timeout: 2000,
	}
})
    .then(async rcon => {
        const gravityValue = parseInt(
            await rcon.exec('sv_gravity')
        ) || 800;
<!---->
        await rcon.exec(`sv_gravity ${gravityValue * 2}`);
    })
    .catch(console.error)
``` 
<!---->
## Options:
		```js
		RCON({
			ip: '0.0.0.0',
			port: 27015,
			password: 'some password'
		})
			.then(rcon => {
				setInterval(() => {
					const value = Math.floor(Math.random() * 10000) - 3000;
					//value will be a number between -3000 and 6999
<!---->
					rcon.exec(`sv_gravity ${value}`)
						.catch(console.error);
<!---->
					//gravity will change randomly every 5 seconds
				}, 5000);
<!---->
<!---->
				rcon.cli.enable(); //now you can execute commands in console
			})
			.catch(console.error);
		```  
</p>
</details>

## Notes

* Bzip decompression function was taken from [here](https://www.npmjs.com/package/bz2)
* Later i will add the 'filter' to `master server query` options

## Valve-games list

Some games witch the module should work  

* Counter-Strike: Global Offensive
* Garry's Mod
* Dota 2
* Half-Life
* Team Fortress 2
* Portal
* Portal 2
* Counter-String
* Counter-Strike: Source
* Dat of Defeat
* Day of Defeat: Source
* Deathmatch Classic
* Ricochet Classic
* Left 4 Dead
* Left 4 Dead 2
* Left 4 Dead: Survivors
* The Lab
* Artifact

[Here](https://steam.fandom.com/wiki/List_of_games_developed_by_Valve_Corporation) is the full list
<!--
# Options

### General 

(this aplies to options of Server, MasterServer and RCON)

These are the default values for options
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
		region: 'OTHER',
		quantity: 200,
	},
    //RCON
    password: 'The RCON password', // hasn't a default value
}
```
-->