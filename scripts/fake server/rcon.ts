import { createServer } from 'net';

export default class FakeRCON {
	constructor(port = 0){
		this.server.on('connection', socket => {
			socket.on('data', data => {
				const [command, ...args] = data.toString().split(' ');
				const response = commands[command](args);

				socket.write(response);
			});
		});

		this.server.listen(port);
	}

	server = createServer()
}