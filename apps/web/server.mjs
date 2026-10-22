import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== 'production';

const httpServer = createServer();
const app = next({ dev, port, httpServer });
const handle = app.getRequestHandler();

await app.prepare();

httpServer.on('request', (req, res) => handle(req, res));

const io = new Server(httpServer, { serveClient: false, destroyUpgrade: false });

async function getSessionUser(handshake) {
	const headers = { 'x-forwarded-for': handshake.headers['x-forwarded-for'] ?? handshake.address };
	if (handshake.headers.cookie) headers.cookie = handshake.headers.cookie;
	const response = await fetch(`http://127.0.0.1:${port}/api/auth/get-session`, { headers });
	if (!response.ok) return null;
	const session = await response.json();
	return session?.user ?? null;
}

io.use(async (socket, nextMiddleware) => {
	try {
		const user = await getSessionUser(socket.handshake);
		if (!user) return nextMiddleware(new Error('unauthorized'));
		socket.data.user = { id: user.id, name: user.name };
		nextMiddleware();
	} catch {
		nextMiddleware(new Error('unauthorized'));
	}
});

io.on('connection', (socket) => {
	socket.join(`user:${socket.data.user.id}`);
});

globalThis.io = io;

httpServer.listen(port, () => {
	console.log(`> ${dev ? 'desenvolvimento' : 'produção'} em http://localhost:${port}`);
});
