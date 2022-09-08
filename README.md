<p align="center">
	<a href="https://fabricio-191.github.io/docs/valve-server-query/" rel="prefetch">
		<img src="https://raw.githubusercontent.com/Fabricio-191/docs/main/src/static/docs1.png">
	</a>
</p>

<a href="https://www.buymeacoffee.com/Fabricio191" target="_blank">
	<img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="20" width="100">
</a>
<a href="https://discord.gg/zrESMn6" target="_blank">
	<img src="https://img.shields.io/discord/555535212461948936?color=7289da" alt="Discord">
</a>
<a href="https://paypal.me/Fabricio191" target="_blank">
	<img src="https://img.shields.io/badge/Donate-PayPal-001570" alt="PayPal">
</a>
<a href="https://github.com/Fabricio-191/simplest.db/actions/workflows/node.js.yml" target="_blank">
	<img src="https://github.com/Fabricio-191/simplest.db/actions/workflows/node.js.yml/badge.svg">
</a>

</br>  

This module allows you to: 
* Easily make queries to servers running valve games
* Make queries to valve master servers
* Use a remote console to control your server remotely

## Links

* [Docs](https://fabricio-191.github.io/docs/valve-server-query/)
* [GitHub](https://github.com/Fabricio-191/valve-server-query)
* [Discord](https://discord.gg/zrESMn6)

## An implementation of valve protocols

```js
const { Server, RCON, MasterServer } = require('@fabricio-191/valve-server-query');
```

**Some** of the games where it works with are:

* Counter-Strike
* Counter-Strike: Global Offensive
* Garry's Mod
* Half-Life
* Team Fortress 2
* Day of Defeat
* The ship

## Examples

#### Server

```js
const server = new Server({
  ip: '0.0.0.0',
  port: 27015,
  timeout: 3000,
});

await server.connect();

const info = await server.getInfo();
console.log(info);

const players = await server.getPlayers();
console.log(players);

const rules = await server.getRules();
console.log(rules);

console.log(server.lastPing);
```

#### Master Server

```js
const servers = await MasterServer({
  quantity: 1000,
  region: 'US_EAST',
  timeout: 3000,
});

//servers is an array if 'ip:port' strings, see the docs
console.log(servers);
```

#### RCON

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
```
