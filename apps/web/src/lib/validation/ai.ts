import { z } from 'zod';

// Schemas do assistente de IA, compartilhados entre o formulário (cliente) e as rotas (servidor).
// Não importe nada de servidor aqui.

export const EXPERIENCE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'EXPERIENCED'] as const;
export type Experience = (typeof EXPERIENCE_LEVELS)[number];

export const PLAN_HOURS_MIN = 1;
export const PLAN_HOURS_MAX = 12;
export const PLAN_NOTES_MAX = 300;
export const PLAN_DAYS_AHEAD = 365;

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Datas "AAAA-MM-DD" se comparam como texto. Aceita desde ontem porque o "hoje"
// do navegador (Brasília) e o do servidor (UTC) podem ser dias diferentes.
function isPlannable(date: string) {
	const now = Date.now();
	return date >= isoDay(now - DAY_MS) && date <= isoDay(now + PLAN_DAYS_AHEAD * DAY_MS);
}

export const planSchema = z.object({
	trailId: z.string('Escolha uma trilha').min(1, 'Escolha uma trilha').max(64),
	date: z.iso.date('Informe uma data válida').refine(isPlannable, 'Escolha uma data entre hoje e daqui a um ano'),
	experience: z.enum(EXPERIENCE_LEVELS, 'Escolha a experiência do grupo'),
	// z.coerce: aceita número ou texto vindo de um <input>
	hours: z.coerce
		.number('Informe as horas disponíveis')
		.int('Use um número inteiro de horas')
		.min(PLAN_HOURS_MIN, `No mínimo ${PLAN_HOURS_MIN} hora`)
		.max(PLAN_HOURS_MAX, `No máximo ${PLAN_HOURS_MAX} horas`),
	notes: z.string().trim().max(PLAN_NOTES_MAX, `Use no máximo ${PLAN_NOTES_MAX} caracteres`).optional(),
});

export type PlanInput = z.output<typeof planSchema>;
