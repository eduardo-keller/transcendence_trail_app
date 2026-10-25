import { sendSmtp } from './smtp';

const FROM = process.env.EMAIL_FROM ?? 'nao-responda@trilhas-sp.local';

// Cabeçalho com acento precisa ser codificado (RFC 2047); quebra de linha é removida (evita injeção de cabeçalho)
const header = (value: string) => `=?UTF-8?B?${Buffer.from(value.replace(/[\r\n]+/g, ' ')).toString('base64')}?=`;

// Envia por SMTP se SMTP_HOST estiver configurado (Mailpit em dev); senão, só registra no log do app.
export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
	const host = process.env.SMTP_HOST;
	if (!host) {
		console.info(`[e-mail] (sem SMTP_HOST, não enviado) para ${to}: ${subject}\n${text}`);
		return;
	}
	const address = to.replace(/[\r\n<>]/g, '');
	const message = [
		`From: ${header('Trilhas SP')} <${FROM}>`,
		`To: <${address}>`,
		`Subject: ${header(subject)}`,
		`Date: ${new Date().toUTCString()}`,
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset=utf-8',
		'Content-Transfer-Encoding: 8bit',
		'',
		text,
	].join('\r\n');
	await sendSmtp(host, Number(process.env.SMTP_PORT ?? 1025), FROM, address, message);
}
