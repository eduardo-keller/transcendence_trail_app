'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useMemo, useState } from 'react';
import { ASK_QUESTION_MAX, askSchema } from '@/lib/validation/ai';
import type { RagSourceRef } from '@/server/ai/rag/retrieve';
import type { AskUIMessage } from '@/server/ai/rag/types';
import type { AiQuota } from '@/server/ai/rate-limit';
import { describeAiError } from '../_components/ai-error';
import { QuotaLine, useQuota } from '../_components/quota';

type Props = {
	quota: AiQuota;
	configured: boolean;
	corpus: { chunks: number; documents: number };
};

const EXAMPLES = [
	'Qual é o ponto mais alto da cidade de São Paulo?',
	'Tem trilha com cachoeira em Paranapiacaba?',
	'O que fazer se uma cobra me picar na trilha?',
	'O que levar numa trilha de um dia?',
];

const textOf = (message: AskUIMessage | undefined) =>
	message?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('') ?? '';

const sourcesOf = (message: AskUIMessage) =>
	message.parts.find((part) => part.type === 'data-sources')?.data ?? [];

const thousands = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function AskChat({ quota, configured, corpus }: Props) {
	const router = useRouter();
	const [input, setInput] = useState('');
	const [inputError, setInputError] = useState<string>();
	const [stopped, setStopped] = useState(false);

	// O navegador monta o corpo do pedido: só a pergunta nova, não o histórico inteiro
	const transport = useMemo(
		() =>
			new DefaultChatTransport<AskUIMessage>({
				api: '/api/ai/ask',
				prepareSendMessagesRequest: ({ messages }) => ({ body: { question: textOf(messages.at(-1)) } }),
			}),
		[],
	);
	// useChat lê o stream: as partes "data-sources" e "text" vão para message.parts conforme chegam.
	// onFinish roda também ao parar e no erro: o pedido gastou cota, então a página relê a cota.
	const { messages, sendMessage, status, error, stop, setMessages, regenerate, clearError } = useChat<AskUIMessage>({
		transport,
		onFinish: () => router.refresh(),
	});
	const busy = status === 'submitted' || status === 'streaming';
	const { blocked, secondsLeft } = useQuota(quota);
	const canSend = configured && !blocked && !busy;

	function ask(question: string) {
		const parsed = askSchema.safeParse({ question });
		if (!parsed.success) {
			setInputError(parsed.error.issues[0]?.message);
			return;
		}
		setInputError(undefined);
		setInput('');
		setStopped(false);
		void sendMessage({ text: parsed.data.question });
	}

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (canSend) ask(input);
	}

	// Enter envia; Shift+Enter quebra a linha
	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (canSend) ask(input);
		}
	}

	function onStop() {
		setStopped(true);
		stop();
	}

	// A conversa só existe no estado desta página: limpar o estado é esquecer
	function newConversation() {
		stop();
		setMessages([]);
		clearError();
		setInput('');
		setInputError(undefined);
		setStopped(false);
	}

	const last = messages.at(-1);

	return (
		<div className="flex flex-col gap-4">
			<p className="text-sm text-stone" data-testid="corpus-size">
				Base: {thousands(corpus.chunks)} trechos de {thousands(corpus.documents)} documentos (artigos da Wikipedia,
				trilhas do OpenStreetMap e guias do Trilhas SP).
			</p>

			<section aria-label="Conversa" aria-live="polite" className="flex flex-col gap-4" data-testid="chat">
				{messages.length === 0 && (
					<div className="flex flex-col gap-2 rounded-card bg-paper p-6">
						<p className="font-semibold">Experimente perguntar:</p>
						<div className="flex flex-wrap gap-2">
							{EXAMPLES.map((example) => (
								<button
									key={example}
									type="button"
									onClick={() => ask(example)}
									disabled={!canSend}
									className="rounded-full border border-sand bg-cream px-4 py-2 text-left text-sm disabled:opacity-60"
								>
									{example}
								</button>
							))}
						</div>
					</div>
				)}
				{messages.map((message) =>
					message.role === 'user' ? (
						<p
							key={message.id}
							className="self-end whitespace-pre-wrap rounded-card bg-forest px-4 py-2 text-paper"
							data-testid="question"
						>
							{textOf(message)}
						</p>
					) : (
						<article key={message.id} className="flex flex-col gap-3 rounded-card bg-paper p-5" data-testid="answer">
							{/* Texto puro: sem markdown nem dangerouslySetInnerHTML; o prompt pede listas com "- " */}
							<div className="whitespace-pre-wrap" data-testid="answer-text">
								{textOf(message)}
							</div>
							<Sources sources={sourcesOf(message)} />
						</article>
					),
				)}
				{status === 'submitted' && <p className="text-stone">Buscando na base…</p>}
				{stopped && !busy && last?.role === 'assistant' && (
					<p role="status" className="text-sm font-semibold text-stone">
						Resposta interrompida.
					</p>
				)}
				{error && (
					<div className="flex flex-col items-start gap-2">
						<p role="alert" className="rounded-lg bg-sand px-3 py-2 text-sm text-ink">
							{describeAiError(error)}
						</p>
						<button
							type="button"
							onClick={() => regenerate()}
							disabled={!canSend}
							className="rounded-full border border-forest px-5 py-2 font-bold text-forest disabled:opacity-60"
						>
							Tentar de novo
						</button>
					</div>
				)}
			</section>

			<form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 rounded-card bg-paper p-5">
				<label className="flex flex-col gap-1">
					<span className="font-semibold">Sua pergunta</span>
					<textarea
						name="question"
						rows={2}
						value={input}
						maxLength={ASK_QUESTION_MAX}
						onChange={(event) => setInput(event.target.value)}
						onKeyDown={onKeyDown}
						placeholder="Ex.: Quais trilhas ficam na Serra da Cantareira?"
						aria-invalid={inputError ? true : undefined}
						className="rounded-lg border border-sand bg-cream px-3 py-2 outline-none focus:border-forest aria-invalid:border-clay"
					/>
					{inputError && <span className="text-sm text-clay">{inputError}</span>}
				</label>
				<div className="flex flex-wrap items-center gap-3">
					<button
						type="submit"
						disabled={!canSend}
						className="rounded-full bg-forest px-5 py-2 font-bold text-paper disabled:opacity-60"
					>
						{busy ? 'Respondendo…' : 'Perguntar'}
					</button>
					{busy && (
						<button
							type="button"
							onClick={onStop}
							className="rounded-full border border-forest px-5 py-2 font-bold text-forest"
						>
							Parar
						</button>
					)}
					{messages.length > 0 && (
						<button type="button" onClick={newConversation} className="text-sm font-bold text-forest underline">
							Nova conversa
						</button>
					)}
				</div>
				{configured ? (
					<QuotaLine quota={quota} secondsLeft={secondsLeft} />
				) : (
					<p role="status" className="text-sm font-semibold text-clay">
						O assistente não está disponível neste servidor (falta a chave do Gemini ou a base não foi carregada).
					</p>
				)}
				<p className="text-xs text-stone">
					A conversa é esquecida ao recarregar a página ou começar uma nova: nada dela fica salvo. A IA pode errar:
					confira as fontes.
				</p>
			</form>
		</div>
	);
}

function Sources({ sources }: { sources: RagSourceRef[] }) {
	if (sources.length === 0) return null;
	return (
		<div className="border-t border-sand pt-3" data-testid="sources">
			<p className="mb-1 text-sm font-bold">Fontes</p>
			<ol className="flex flex-col gap-1 text-sm">
				{sources.map((source) => (
					<li key={source.n} className="flex flex-wrap items-baseline gap-x-2">
						<span className="font-bold">[{source.n}]</span>
						{source.url ? (
							<a href={source.url} target="_blank" rel="noopener noreferrer" className="text-forest underline">
								{source.title}
							</a>
						) : (
							<span>{source.title}</span>
						)}
						{source.source === 'TRAIL' && source.trailId && (
							<Link href={`/planejar?trilha=${source.trailId}`} className="font-semibold text-moss underline">
								Planejar esta trilha
							</Link>
						)}
						<span className="text-stone">
							{[
								source.source === 'GUIDE' ? 'Guia do Trilhas SP' : source.license,
								`relevância ${source.score.toFixed(2).replace('.', ',')}`,
							]
								.filter(Boolean)
								.join(' · ')}
						</span>
					</li>
				))}
			</ol>
		</div>
	);
}
