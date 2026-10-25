import { connect } from 'node:net';

// Cliente SMTP mínimo, sem TLS, para um servidor de e-mail local (ex.: Mailpit).
// O protocolo é texto: o cliente manda um comando e o servidor responde "código texto".
// Uma resposta pode ter várias linhas ("250-..."); a última tem espaço depois do código ("250 ...").
export async function sendSmtp(host: string, port: number, from: string, to: string, message: string) {
	const socket = connect(port, host);
	socket.setEncoding('utf8');
	socket.setTimeout(10_000, () => socket.destroy(new Error('SMTP: tempo esgotado')));

	let received = '';
	const waiting: ((reply: string) => void)[] = [];

	// Entrega cada resposta completa para quem está esperando, na ordem
	function deliver() {
		while (waiting.length) {
			const lines = received.split('\r\n');
			const last = lines.findIndex((line) => /^\d{3} /.test(line));
			if (last === -1 || last === lines.length - 1) return; // resposta ainda incompleta
			received = lines.slice(last + 1).join('\r\n');
			waiting.shift()?.(lines.slice(0, last + 1).join('\n'));
		}
	}
	socket.on('data', (chunk: string) => {
		received += chunk;
		deliver();
	});
	const failed = new Promise<never>((_, reject) => socket.once('error', reject));

	async function expect(code: number) {
		const reply = new Promise<string>((resolve) => waiting.push(resolve));
		deliver();
		const text = await Promise.race([reply, failed]);
		if (!text.startsWith(String(code))) throw new Error(`SMTP: esperava ${code}, veio "${text}"`);
	}
	async function command(line: string, code: number) {
		socket.write(`${line}\r\n`);
		await expect(code);
	}

	try {
		await expect(220); // saudação do servidor
		await command('EHLO trilhas-sp', 250);
		await command(`MAIL FROM:<${from}>`, 250);
		await command(`RCPT TO:<${to}>`, 250);
		await command('DATA', 354);
		// A mensagem termina com uma linha só com "."; linhas do texto que começam com "." ganham outro ponto
		const body = message.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
		await command(`${body}\r\n.`, 250);
		await command('QUIT', 221);
	} finally {
		socket.destroy();
	}
}
