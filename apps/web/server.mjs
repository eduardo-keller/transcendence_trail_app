import { createServer } from 'node:http';
import next from 'next';

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== 'production';

const httpServer = createServer();
const app = next({ dev, port, httpServer });
const handle = app.getRequestHandler();

await app.prepare();

httpServer.on('request', (req, res) => handle(req, res));
httpServer.listen(port, () => {
	console.log(`> ${dev ? 'desenvolvimento' : 'produção'} em http://localhost:${port}`);
});
