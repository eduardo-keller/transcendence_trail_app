import { withHandler } from '@/server/api';
import { requireUser } from '@/server/auth/session';
import { sendEmail } from '@/server/email/send';
import { buildDataExport } from '@/server/privacy/export';

// GDPR: baixa todos os dados da pessoa logada, em JSON legível, e avisa por e-mail
export const GET = withHandler(async () => {
	const user = await requireUser();
	const data = await buildDataExport(user.id);
	const day = new Date().toISOString().slice(0, 10);

	// O aviso não pode impedir o download: se o e-mail falhar, só registra
	await sendEmail({
		to: user.email,
		subject: 'Você baixou uma cópia dos seus dados',
		text: `Olá, ${user.name}.\n\nEm ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} foi feita uma exportação dos seus dados da Trilhas SP.\nSe não foi você, troque a sua senha em Minha conta.\n`,
	}).catch((error) => console.error('[e-mail] falha ao avisar a exportação', error));
	// TODO(notify): "Pedir os dados" quando o notify() do Rafa existir

	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="trilhas-sp-meus-dados-${day}.json"`,
			'Cache-Control': 'no-store',
		},
	});
});
