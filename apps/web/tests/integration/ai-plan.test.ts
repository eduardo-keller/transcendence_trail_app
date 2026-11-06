import type { Trail, User } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/ai/plan/route';
import { prisma } from '@/lib/db';
import { AI_ERROR_MESSAGES } from '@/server/ai/errors';
import { MOCK_FAILURE_TRIGGER, mockLanguageModel } from '@/server/ai/mock';
import { consumeAiQuota, getAiQuota } from '@/server/ai/rate-limit';
import { listPlannableTrails } from '@/server/ai/trails';
import { createTrail, createUser, resetDatabase } from '../helpers/db';
import { signInAs } from '../helpers/session';

vi.mock('@/server/auth/session', () => import('../helpers/session'));
// O mock sem atraso: o teste não precisa do "efeito de digitação"
vi.mock('@/server/ai/model', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/server/ai/model')>()),
	languageModel: () => mockLanguageModel({ chunkDelayInMs: null }),
}));

// Relógio fixo no meio de um minuto: as janelas do rate limit não viram durante o teste
const NOW = new Date('2026-11-10T12:00:30Z');

let ana: User;
let bia: User;
let trail: Trail;
let valid: Record<string, unknown>;

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
	vi.stubEnv('AI_LIMIT_PER_MINUTE', '5');
	vi.stubEnv('AI_LIMIT_PER_DAY', '50');
	await resetDatabase();
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	trail = await createTrail({ title: 'Trilha Pedra Grande', source: 'OSM', distance: 2450 });
	valid = { trailId: trail.id, date: '2026-11-15', experience: 'BEGINNER', hours: 4 };
	signInAs(ana);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

afterAll(async () => {
	await prisma.$disconnect();
});

const plan = (body: unknown) =>
	POST(
		new Request('http://localhost/api/ai/plan', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: typeof body === 'string' ? body : JSON.stringify(body),
		}),
		undefined,
	);

// O stream do AI SDK é SSE: uma linha "data: {json}" por parte
async function readStream(response: Response) {
	const parts = (await response.text())
		.split('\n')
		.filter((line) => line.startsWith('data: {'))
		.map((line) => JSON.parse(line.slice('data: '.length)));
	return {
		types: parts.map((part) => part.type as string),
		text: parts.filter((part) => part.type === 'text-delta').map((part) => part.delta).join(''),
		errors: parts.filter((part) => part.type === 'error').map((part) => part.errorText as string),
	};
}

const usageCount = () => prisma.aiUsage.count();

describe('POST /api/ai/plan', () => {
	it('sem login → 401', async () => {
		signInAs(null);
		const response = await plan(valid);
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
	});

	it('entrada inválida → 400 com os campos errados, sem gastar cota', async () => {
		const response = await plan({ ...valid, hours: 0, experience: 'PRO' });
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error.code).toBe('VALIDATION_ERROR');
		expect(body.error.details.issues.map((issue: { path: string }) => issue.path).sort()).toEqual(['experience', 'hours']);
		expect((await plan('{nao é json')).status).toBe(400);
		expect(await usageCount()).toBe(0);
	});

	it('trilha inexistente ou privada de outra pessoa → 404, sem gastar cota', async () => {
		const privada = await createTrail({ title: 'Segredo da Bia', authorId: bia.id, visibility: 'PRIVATE' });
		for (const trailId of ['nao-existe', privada.id]) {
			const response = await plan({ ...valid, trailId });
			expect(response.status).toBe(404);
			expect(await response.json()).toMatchObject({ error: { code: 'TRAIL_NOT_FOUND' } });
		}
		expect(await usageCount()).toBe(0);
	});

	it('gera o plano em streaming e gasta 1 pedido da cota', async () => {
		const response = await plan(valid);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/event-stream');
		const { types, text, errors } = await readStream(response);
		expect(types.filter((type) => type === 'text-delta').length).toBeGreaterThan(20);
		expect(text).toContain('LLM_PROVIDER=mock');
		expect(errors).toEqual([]);
		expect(await getAiQuota(ana.id)).toMatchObject({ remainingMinute: 4, remainingDay: 49, retryAt: null });
	});

	it('provedor cai no meio → parte "error" com a mensagem amigável; o detalhe só no log', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const response = await plan({ ...valid, notes: `teste ${MOCK_FAILURE_TRIGGER}` });
		expect(response.status).toBe(200);
		const { text, errors } = await readStream(response);
		expect(text.length).toBeGreaterThan(0);
		expect(errors).toEqual([AI_ERROR_MESSAGES.unavailable]);
		expect(log).toHaveBeenCalledWith('[ai/plan] erro do provedor:', expect.any(Error));
	});

	it('10 pedidos ao mesmo tempo com limite 5 → exatamente 5 passam, 5 recebem 429', async () => {
		const responses = await Promise.all(Array.from({ length: 10 }, () => plan(valid)));
		const statuses = responses.map((response) => response.status).sort();
		expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429, 429, 429, 429]);

		const limited = responses.find((response) => response.status === 429);
		expect(await limited?.json()).toMatchObject({
			error: { code: 'AI_RATE_LIMITED', details: { retryAfter: 30, retryAt: '2026-11-10T12:01:00.000Z' } },
		});
		await Promise.all(responses.filter((r) => r.status === 200).map((r) => r.body?.cancel()));

		// A cota é por usuário: a Bia continua podendo
		signInAs(bia);
		expect((await plan(valid)).status).toBe(200);
	});
});

describe('consumeAiQuota', () => {
	it('teto diário: bloqueia até a meia-noite UTC, mesmo em outro minuto; no dia seguinte libera', async () => {
		vi.stubEnv('AI_LIMIT_PER_MINUTE', '10');
		vi.stubEnv('AI_LIMIT_PER_DAY', '2');
		await consumeAiQuota(ana.id, NOW);
		expect(await consumeAiQuota(ana.id, NOW)).toMatchObject({
			remainingDay: 0,
			retryAt: '2026-11-11T00:00:00.000Z',
		});

		const later = new Date('2026-11-10T18:00:00Z');
		await expect(consumeAiQuota(ana.id, later)).rejects.toMatchObject({
			status: 429,
			message: 'Você usou todos os pedidos do assistente de hoje.',
			details: { retryAfter: 6 * 60 * 60 },
		});

		const nextDay = new Date('2026-11-11T08:00:00Z');
		expect(await consumeAiQuota(ana.id, nextDay)).toMatchObject({ remainingDay: 1 });
		// Os contadores do dia anterior foram apagados (guarda só o dia de hoje)
		const periods = (await prisma.aiUsage.findMany({ where: { userId: ana.id } })).map((row) => row.period).sort();
		expect(periods).toEqual(['2026-11-11', '2026-11-11T08:00']);
	});

	it('getAiQuota só lê: não gasta pedido', async () => {
		await getAiQuota(ana.id, NOW);
		await getAiQuota(ana.id, NOW);
		expect(await usageCount()).toBe(0);
		expect(await getAiQuota(ana.id, NOW)).toMatchObject({ limitPerMinute: 5, remainingMinute: 5, retryAt: null });
	});
});

describe('listPlannableTrails', () => {
	it('só as trilhas do OSM com 500 m ou mais e nome de trilha, em ordem alfabética', async () => {
		await createTrail({ title: 'Pico do Jaraguá', source: 'OSM', distance: 3000 });
		await createTrail({ title: 'Viela H', source: 'OSM', distance: 800 });
		await createTrail({ title: 'Trilha Curta', source: 'OSM', distance: 300 });
		await createTrail({ title: 'Trilha da Ana', source: 'USER', authorId: ana.id, distance: 2000 });
		const titles = (await listPlannableTrails()).map((option) => option.title);
		expect(titles).toEqual(['Pico do Jaraguá', 'Trilha Pedra Grande']);
	});
});
