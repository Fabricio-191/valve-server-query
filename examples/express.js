/* eslint-disable no-console */
const { Server } = require('@fabricio-191/valve-server-query');
const express = require('express');
const app = express();

const servers = {};

async function getServer(address){
	if(!(address in servers)){
		servers[address] = new Server();

		await servers[address].connect(address);
	}

	return servers[address];
}

app.get('/api/getInfo/:address', async (req, res) => {
	try{
		const server = await getServer(req.params.address);
		const info = await server.getInfo();

		res.json(info);
	}catch(e){
		res.status(500).json({ error: e.message });
	}
});

app.get('/api/getPlayers/:address', async (req, res) => {
	try{
		const server = await getServer(req.params.address);
		const info = await server.getPlayers();

		res.json(info);
	}catch(e){
		res.status(500).json({ error: e.message });
	}
});

app.get('/api/getRules/:address', async (req, res) => {
	try{
		const server = await getServer(req.params.address);
		const info = await server.getRules();

		res.json(info);
	}catch(e){
		res.status(500).json({ error: e.message });
	}
});

app.listen(3000, () => {
	console.log('Example app listening on port 3000!');
});