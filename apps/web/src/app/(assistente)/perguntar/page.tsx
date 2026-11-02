import { isAiConfigured, isMockProvider } from '@/server/ai/model';
import { corpusSize } from '@/server/ai/rag/retrieve';
import { getAiQuota } from '@/server/ai/rate-limit';
import { requirePageUser } from '@/server/auth/session';
import { AskChat } from './ask-chat';

export const metadata = { title: 'Perguntar sobre as trilhas · Trilhas SP' };

export default async function AskPage() {
	const user = await requirePageUser();
	const [quota, corpus] = await Promise.all([getAiQuota(user.id), corpusSize()]);

	return (
		<main className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h1 className="font-display text-3xl font-bold text-forest">Pergunte sobre as trilhas</h1>
				<p className="text-stone">
					Pergunte sobre trilhas, parques, natureza e segurança na região de São Paulo. O assistente busca a resposta
					numa base própria e mostra de onde cada informação veio.
				</p>
				{isMockProvider() && (
					<p className="text-sm font-semibold text-moss">
						Modo de teste: a busca é por palavras e as respostas são fixas (LLM_PROVIDER=mock).
					</p>
				)}
			</header>
			<AskChat quota={quota} corpus={corpus} configured={isAiConfigured() && corpus.chunks > 0} />
		</main>
	);
}
