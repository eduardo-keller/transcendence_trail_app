import Link from 'next/link';
import type { ReactNode } from 'react';

export const LAST_UPDATE = '25 de outubro de 2026';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
	return (
		<main className="mx-auto max-w-3xl px-4 py-10">
			<h1 className="font-display text-3xl font-bold text-forest">{title}</h1>
			<p className="mb-8 text-sm text-stone">Última atualização: {LAST_UPDATE}</p>
			<div className="flex flex-col gap-6 leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-6">
				{children}
			</div>
			<p className="mt-10 text-sm">
				<Link href="/privacidade" className="font-bold text-forest underline">
					Política de Privacidade
				</Link>{' '}
				·{' '}
				<Link href="/termos" className="font-bold text-forest underline">
					Termos de Uso
				</Link>
			</p>
		</main>
	);
}
