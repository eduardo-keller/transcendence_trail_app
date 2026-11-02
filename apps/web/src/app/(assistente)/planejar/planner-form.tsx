'use client';

import { useCompletion } from '@ai-sdk/react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { type PlanInput, PLAN_HOURS_MAX, PLAN_HOURS_MIN, PLAN_NOTES_MAX, planSchema } from '@/lib/validation/ai';
import type { AiQuota } from '@/server/ai/rate-limit';
import type { TrailOption } from '@/server/ai/trails';
import { describeAiError } from '../_components/ai-error';
import { QuotaLine, useQuota } from '../_components/quota';

type Props = {
	trails: TrailOption[];
	initialTrailId: string | null;
	dateRange: { today: string; last: string };
	quota: AiQuota;
	configured: boolean;
};

type FieldErrors = Partial<Record<keyof PlanInput, string>>;

const DIFFICULTY = { EASY: 'fácil', MODERATE: 'moderada', HARD: 'difícil' } as const;
const km = (meters: number) => `${(meters / 1000).toFixed(1).replace('.', ',')} km`;

const inputClass =
	'rounded-lg border border-sand bg-paper px-3 py-2 outline-none focus:border-forest aria-invalid:border-clay';

export function PlannerForm({ trails, initialTrailId, dateRange, quota, configured }: Props) {
	const router = useRouter();
	// O hook faz o POST, lê o stream (SSE) e junta os pedaços em `completion` a cada "text-delta".
	// stop() aborta o fetch; no servidor, isso dispara o request.signal, que cancela a chamada ao Gemini.
	const { completion, complete, stop, isLoading, error } = useCompletion({ api: '/api/ai/plan' });
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [lastInput, setLastInput] = useState<PlanInput | null>(null);
	const [stopped, setStopped] = useState(false);
	const { blocked, secondsLeft } = useQuota(quota);

	async function generate(input: PlanInput) {
		setLastInput(input);
		setStopped(false);
		// O hook manda { prompt, ...body }: o servidor valida o body com o mesmo planSchema e ignora o prompt
		await complete('', { body: input });
		// O pedido gastou cota: o Server Component lê de novo e o botão se desabilita antes do 429
		router.refresh();
	}

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = Object.fromEntries(new FormData(event.currentTarget));
		const parsed = planSchema.safeParse({ ...data, notes: data.notes || undefined });
		if (!parsed.success) {
			const errors: FieldErrors = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[0] as keyof PlanInput;
				errors[field] ??= issue.message;
			}
			setFieldErrors(errors);
			return;
		}
		setFieldErrors({});
		void generate(parsed.data);
	}

	function onStop() {
		setStopped(true);
		stop();
	}

	const canGenerate = configured && !blocked && !isLoading;

	return (
		<div className="flex flex-col gap-6">
			<form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-card bg-paper p-6">
				<label className="flex flex-col gap-1">
					<span className="font-semibold">Trilha</span>
					<select
						name="trailId"
						defaultValue={initialTrailId ?? ''}
						aria-invalid={fieldErrors.trailId ? true : undefined}
						className={inputClass}
					>
						<option value="">Escolha uma trilha</option>
						{trails.map((trail) => (
							<option key={trail.id} value={trail.id}>
								{trail.title} · {km(trail.distance)} · {DIFFICULTY[trail.difficulty]}
							</option>
						))}
					</select>
					<FieldError message={fieldErrors.trailId} />
				</label>

				<div className="grid gap-4 sm:grid-cols-3">
					<label className="flex flex-col gap-1">
						<span className="font-semibold">Data</span>
						<input
							type="date"
							name="date"
							defaultValue={dateRange.today}
							min={dateRange.today}
							max={dateRange.last}
							aria-invalid={fieldErrors.date ? true : undefined}
							className={inputClass}
						/>
						<FieldError message={fieldErrors.date} />
					</label>
					<label className="flex flex-col gap-1">
						<span className="font-semibold">Experiência do grupo</span>
						<select name="experience" defaultValue="BEGINNER" className={inputClass}>
							<option value="BEGINNER">Iniciante</option>
							<option value="INTERMEDIATE">Intermediário</option>
							<option value="EXPERIENCED">Experiente</option>
						</select>
						<FieldError message={fieldErrors.experience} />
					</label>
					<label className="flex flex-col gap-1">
						<span className="font-semibold">Horas disponíveis</span>
						<input
							type="number"
							name="hours"
							defaultValue={4}
							min={PLAN_HOURS_MIN}
							max={PLAN_HOURS_MAX}
							step={1}
							aria-invalid={fieldErrors.hours ? true : undefined}
							className={inputClass}
						/>
						<FieldError message={fieldErrors.hours} />
					</label>
				</div>

				<label className="flex flex-col gap-1">
					<span className="font-semibold">Observações (opcional)</span>
					<textarea
						name="notes"
						rows={2}
						maxLength={PLAN_NOTES_MAX}
						placeholder="Ex.: vamos com duas crianças de 8 anos; queremos parar para almoçar"
						aria-invalid={fieldErrors.notes ? true : undefined}
						className={inputClass}
					/>
					<FieldError message={fieldErrors.notes} />
				</label>

				<div className="flex flex-wrap items-center gap-3">
					<button
						type="submit"
						disabled={!canGenerate}
						className="rounded-full bg-forest px-5 py-2 font-bold text-paper disabled:opacity-60"
					>
						{isLoading ? 'Gerando…' : 'Gerar plano'}
					</button>
					{isLoading && (
						<button
							type="button"
							onClick={onStop}
							className="rounded-full border border-forest px-5 py-2 font-bold text-forest"
						>
							Parar
						</button>
					)}
				</div>
				{configured ? (
					<QuotaLine quota={quota} secondsLeft={secondsLeft} />
				) : (
					<p role="status" className="text-sm font-semibold text-clay">
						O assistente não está configurado neste servidor (falta a chave do Gemini).
					</p>
				)}
			</form>

			{(completion || isLoading || error || stopped) && (
				<section aria-labelledby="plano-titulo" className="flex flex-col gap-3 rounded-card bg-paper p-6">
					<h2 id="plano-titulo" className="font-display text-xl font-bold">
						Plano
					</h2>
					{/* Texto puro: sem markdown nem dangerouslySetInnerHTML; o prompt pede listas com "- " */}
					<div aria-live="polite" aria-busy={isLoading} className="whitespace-pre-wrap" data-testid="plan-output">
						{completion}
						{isLoading && !completion && <span className="text-stone">Gerando o plano…</span>}
					</div>
					{stopped && !isLoading && (
						<p role="status" className="text-sm font-semibold text-stone">
							Geração interrompida: o plano acima está incompleto.
						</p>
					)}
					{error && (
						<p role="alert" className="rounded-lg bg-sand px-3 py-2 text-sm text-ink">
							{describeAiError(error)}
						</p>
					)}
					{(error || stopped) && !isLoading && lastInput && (
						<button
							type="button"
							onClick={() => generate(lastInput)}
							disabled={!canGenerate}
							className="self-start rounded-full border border-forest px-5 py-2 font-bold text-forest disabled:opacity-60"
						>
							Tentar de novo
						</button>
					)}
				</section>
			)}
		</div>
	);
}

function FieldError({ message }: { message?: string }) {
	if (!message) return null;
	return <span className="text-sm text-clay">{message}</span>;
}
