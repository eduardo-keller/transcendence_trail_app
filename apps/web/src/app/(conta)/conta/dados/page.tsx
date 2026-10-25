import Link from 'next/link';
import { hasPassword } from '@/server/auth/account';
import { requirePageUser } from '@/server/auth/session';
import { DeleteAccountForm } from '../../_components/delete-account-form';

export const metadata = { title: 'Privacidade e dados · Trilhas SP' };

export default async function DataPage() {
	const user = await requirePageUser();
	const withPassword = await hasPassword(user.id);

	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
			<header>
				<Link href="/conta" className="text-sm font-bold text-forest underline">
					← Minha conta
				</Link>
				<h1 className="mt-2 font-display text-3xl font-bold text-forest">Privacidade e dados</h1>
				<p className="text-stone">
					Seus direitos (LGPD/GDPR) e como exercê-los. Detalhes na{' '}
					<Link href="/privacidade" className="font-bold text-forest underline">
						Política de Privacidade
					</Link>
					.
				</p>
			</header>

			<section className="rounded-card bg-paper p-6">
				<h2 className="mb-2 font-display text-xl font-bold">Baixar meus dados</h2>
				<p className="mb-4">Um arquivo JSON com tudo o que guardamos sobre você. Avisamos por e-mail a cada exportação.</p>
				<a href="/api/me/export" download className="inline-block rounded-full bg-forest px-5 py-2 font-bold text-paper">
					Baixar meus dados
				</a>
			</section>

			<section className="rounded-card bg-paper p-6">
				<h2 className="mb-2 font-display text-xl font-bold">Corrigir meus dados</h2>
				<p>
					Nome, nome de usuário, bio e foto se editam em{' '}
					<Link href="/conta" className="font-bold text-forest underline">
						Minha conta
					</Link>
					.
				</p>
			</section>

			<section className="rounded-card border border-clay bg-paper p-6">
				<h2 className="mb-2 font-display text-xl font-bold text-clay">Excluir minha conta</h2>
				<DeleteAccountForm withPassword={withPassword} />
			</section>
		</main>
	);
}
