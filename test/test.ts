import { createSocket } from 'dgram';

const socket = createSocket('udp4').unref();

socket.on('message', (msg) => {
	console.log(msg);
});

socket.send(Buffer.from('test'), 27015, 'google.com');
