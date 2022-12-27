/*
Example of a tiny personalized Discord bot for a server
*/
const Discord = require('discord.js');
const { Server, ServerWacth } = require('@fabricio-191/valve-server-query');

const client = new Discord.Client();
const server = new Server({
	ip: '127.0.0.1',
	port: 27015,
});
const serverWatch = new ServerWacth(server, {
	interval: 1000,
});
const serverData = {};

client.on('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`);
	await server.connect();

	const data = await server.getInfo();
	Object.assign(serverData, data);

	serverData.battlemetrics = await getBattlemetricsURL();
});

async function getBattlemetricsURL(){
	const serversList = await fetch('https://api.battlemetrics.com/servers?filter[search]=' + encodeURIComponent(serverData.name));
	const servers = await serversList.json();

	const { id, relationships } = servers.data[0];

	return `https://www.battlemetrics.com/servers/${relationships.game.data.id}/${id}`;
}

const PREFIX = '!';
client.on('message', async message => {
	if(message.author.bot) return;
	if(!message.content.startsWith(PREFIX)) return;

	const args = message.content.slice(PREFIX.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();

	if(command === 'status'){
		const info = await server.getInfo();
		const embed = {
			color: 0x0099ff,
			title: info.name,
			url: serverData.battlemetrics,
		};

		message.channel.send({ embed });
	}else if(command === 'players'){
		const players = await server.getPlayers();
		const embed = {
			color: 0x0099ff,
			title: serverData.name,
			url: serverData.battlemetrics,
			fields: players.map(player => ({
				name: player.name,
				value: player.score,
			})),
		};

		message.channel.send({ embed });
	}
});

client.login('your-token');