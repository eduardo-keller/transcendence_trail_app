import { prisma } from '@/lib/db';
import { ApiError } from '@/server/api';

// Rate limit do assistente de IA, por usuário, com janela fixa: um contador por minuto e um por dia (UTC).
// Cada pedido soma 1 nos dois; se algum passar do limite, o pedido é recusado com 429.
// Fica no banco, e não em memória, para o teto diário sobreviver a um restart do container.

const MINUTE_MS = 60_000;

export type AiQuota = {
	limitPerMinute: number;
	limitPerDay: number;
	remainingMinute: number;
	remainingDay: number;
	retryAt: string | null; // quando o próximo pedido volta a ser aceito; null = já pode
};

function positiveInt(value: string | undefined, fallback: number) {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : fallback;
}

function limits() {
	return {
		minute: positiveInt(process.env.AI_LIMIT_PER_MINUTE, 5),
		day: positiveInt(process.env.AI_LIMIT_PER_DAY, 50),
	};
}

// As duas janelas em que `now` cai ("2026-11-02T13:05" e "2026-11-02") e quando cada uma acaba
function windowsAt(now: Date) {
	const iso = now.toISOString();
	return {
		minute: { period: iso.slice(0, 16), endsAt: Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS },
		day: { period: iso.slice(0, 10), endsAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) },
	};
}

function toQuota(usedMinute: number, usedDay: number, now: Date): AiQuota {
	const limit = limits();
	const { minute, day } = windowsAt(now);
	const remainingMinute = Math.max(0, limit.minute - usedMinute);
	const remainingDay = Math.max(0, limit.day - usedDay);
	// Esgotou: libera quando a janela que esgotou acabar (se for a do dia, ela manda)
	const retryAt = remainingDay === 0 ? day.endsAt : remainingMinute === 0 ? minute.endsAt : null;
	return {
		limitPerMinute: limit.minute,
		limitPerDay: limit.day,
		remainingMinute,
		remainingDay,
		retryAt: retryAt === null ? null : new Date(retryAt).toISOString(),
	};
}

// Soma 1 e devolve o total. O Prisma transforma este upsert num único
// INSERT … ON CONFLICT DO UPDATE: atômico, sem "ler, somar e gravar" (duas abas juntas não furam o limite).
async function increment(userId: string, period: string) {
	const row = await prisma.aiUsage.upsert({
		where: { userId_period: { userId, period } },
		create: { userId, period, count: 1 },
		update: { count: { increment: 1 } },
		select: { count: true },
	});
	return row.count;
}

// Chamar uma vez por pedido, depois de validar a entrada (pedido inválido não gasta cota).
// Tentativa recusada também conta: não muda nada na prática, porque a janela zera sozinha.
export async function consumeAiQuota(userId: string, now = new Date()): Promise<AiQuota> {
	const { minute, day } = windowsAt(now);
	const [usedMinute, usedDay] = await Promise.all([
		increment(userId, minute.period),
		increment(userId, day.period),
		// Só o dia de hoje interessa: apaga os contadores de dias anteriores ("2026-11-01…" < "2026-11-02")
		prisma.aiUsage.deleteMany({ where: { userId, period: { lt: day.period } } }),
	]);

	const quota = toQuota(usedMinute, usedDay, now);
	if (usedMinute > quota.limitPerMinute || usedDay > quota.limitPerDay) {
		const retryAfter = Math.ceil((Date.parse(quota.retryAt ?? '') - now.getTime()) / 1000);
		const message =
			usedDay > quota.limitPerDay
				? 'Você usou todos os pedidos do assistente de hoje.'
				: 'Muitos pedidos ao assistente em pouco tempo. Espere um pouco e tente de novo.';
		throw new ApiError(429, 'AI_RATE_LIMITED', message, { retryAfter, retryAt: quota.retryAt });
	}
	return quota;
}

// Só lê (para a tela mostrar quanto falta e desabilitar o botão antes do 429)
export async function getAiQuota(userId: string, now = new Date()): Promise<AiQuota> {
	const { minute, day } = windowsAt(now);
	const rows = await prisma.aiUsage.findMany({
		where: { userId, period: { in: [minute.period, day.period] } },
		select: { period: true, count: true },
	});
	const used = (period: string) => rows.find((row) => row.period === period)?.count ?? 0;
	return toQuota(used(minute.period), used(day.period), now);
}
