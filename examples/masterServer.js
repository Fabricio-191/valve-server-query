const { MasterServer, Server } = require('@fabricio-191/valve-server-query');

const queries = [];

const onChunk = chunk => {
	queries.push(Promise.allSettled(chunk.map(Server.getInfo)))
}

MasterServer({
	quantity: 15000,
	slow: true,
}, onChunk)
	.then(servers => { // pseudo end event

	})
	.catch(console.error);  // pseudo error event


/*
As masterservers are heavily rate limited to: 30 request per minute and 60 request per 5 minutes
There are 2 options to get around this:
	1. Make 1 request every 5 seconds (slow=true option)
	2. Make a maximun of 30 request in 1 minute and a maximun of 60 request in 5 minutes (slow=false option)
*/

// onChunk callback will be executed with every chunk recieved from the master server
