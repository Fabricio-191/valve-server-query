[![License](https://img.shields.io/github/license/Fabricio-191/valve-protocols?color=white&style=for-the-badge)](https://github.com/Fabricio-191/valve-protocols/blob/master/LICENSE)
[![Issues](https://img.shields.io/github/issues/Fabricio-191/valve-protocols?style=for-the-badge)](https://github.com/Fabricio-191/valve-protocols/issues)


# Implementation of some valve protocols:
## [Server query](https://developer.valvesoftware.com/wiki/Server_queries) and for [master server query](https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol)


Bzip decompression function was taken from [here](https://www.npmjs.com/package/bz2)

___

## Docs

* ### [Server query](https://github.com/Fabricio-191/valve-protocols/blob/master/docs/Server.md)
* ### [Master server query](https://github.com/Fabricio-191/valve-protocols/blob/master/docs/MasterServer.md)  
  
(later i will add RCON)

> If you have any error you can contact me on [Discord](https://discord.gg/zrESMn6) or [GitHub](https://github.com/Fabricio-191/valve-server-query/issues) (i prefer Discord)

## Use example

```js
const { Server, MasterServer } = require('@fabricio-191/valve-server-query');

MasterServer({
    quantity: 200
}).then(async servers => {
		console.log(servers);
		console.log('\n'.repeat(5));
		
		let [ip, port] = servers[0].split(':');

		console.log(ip+':'+port);

		let sv = new Server({ ip, port });

		await sv.getInfo()
			.then(console.log)
			.catch(console.error);

		await new Promise(res => setTimeout(res, 3000));
		console.log('\n'.repeat(5));

		await sv.getPlayers()
			.then(console.log)
			.catch(console.error);

		await new Promise(res => setTimeout(res, 3000));
		console.log('\n'.repeat(5));

		await sv.getRules()
			.then(console.log)
			.catch(console.error);

		await new Promise(res => setTimeout(res, 3000));
		console.log('\n'.repeat(5));
	})
	.catch(console.error);
```