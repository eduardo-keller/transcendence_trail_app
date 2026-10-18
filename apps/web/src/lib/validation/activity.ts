import { z } from 'zod';

// Schemas de atividade compartilhados entre o formulário (cliente) e as server actions (servidor).
// Não importe nada de servidor aqui.

const MAX_DISTANCE_M = 1_000_000; // 1000 km
const MAX_DURATION_S = 7 * 24 * 60 * 60; // 7 dias
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const title = z.string().trim().min(1, 'Informe um título').max(120);
// z.coerce: aceita número ou texto vindo de um <input>
const distance = z.coerce.number().min(0).max(MAX_DISTANCE_M); // metros
const duration = z.coerce.number().int().positive('Duração deve ser maior que zero').max(MAX_DURATION_S); // segundos
const startedAt = z.coerce
	.date()
	.refine((date) => date.getTime() <= Date.now() + CLOCK_SKEW_MS, 'A data não pode estar no futuro');
const trailId = z.string().min(1).max(64).nullable();
const polyline = z.string().max(200_000).nullable();

// Sem distance, usa a distância da trilha (trailId); um dos dois é obrigatório
export const createActivitySchema = z
	.object({
		title,
		distance: distance.optional(),
		duration,
		startedAt: startedAt.optional(),
		trailId: trailId.optional(),
		polyline: polyline.optional(),
	})
	.refine((a) => a.distance !== undefined || a.trailId, {
		path: ['distance'],
		message: 'Informe a distância ou a trilha percorrida',
	});

// trailId: null desvincula a atividade da trilha
export const updateActivitySchema = z
	.object({ title, distance, duration, startedAt, trailId, polyline })
	.partial()
	.refine((fields) => Object.values(fields).some((value) => value !== undefined), 'Informe ao menos um campo');

export type CreateActivityInput = z.input<typeof createActivitySchema>;
export type UpdateActivityInput = z.input<typeof updateActivitySchema>;
