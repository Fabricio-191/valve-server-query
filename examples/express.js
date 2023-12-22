/* eslint-disable no-console */
const { Server } = require('@fabricio-191/valve-server-query');
const express = require('express');
const app = express();

app.get('/api/getInfo/:address', (req, res) => {
	Server.getInfo(req.params.address)
		.then(info => res.json(info))
		.catch(e => res.status(500).json({ error: e.message }));
});

app.get('/api/getPlayers/:address', (req, res) => {
	Server.getPlayers(req.params.address)
		.then(players => res.json(players))
		.catch(e => res.status(500).json({ error: e.message }));
});

app.get('/api/getRules/:address', (req, res) => {
	Server.getRules(req.params.address)
		.then(rules => res.json(rules))
		.catch(e => res.status(500).json({ error: e.message }));
});

app.listen(3000, () => {
	console.log('Example app listening on port 3000!');
});