'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AiQuota } from '@/server/ai/rate-limit';

// Cota do assistente na tela. A página (Server Component) lê a cota do banco; aqui o botão é desabilitado
// ANTES do 429, porque o Chrome mostra no console toda resposta 4xx de fetch (e console com erro reprova).
// Quando a janela do limite acaba, router.refresh() pede ao servidor a cota nova.

// Margem para a diferença entre o relógio do navegador e o do servidor
const CLOCK_MARGIN_MS = 1000;

export function useQuota(quota: AiQuota) {
	const router = useRouter();
	// null até montar: calcular o tempo no servidor e no navegador daria erro de hidratação
	const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

	useEffect(() => {
		if (!quota.retryAt) {
			setSecondsLeft(null);
			return;
		}
		const retryAt = Date.parse(quota.retryAt) + CLOCK_MARGIN_MS;
		const tick = () => {
			const left = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
			setSecondsLeft(left);
			if (left === 0) {
				clearInterval(timer);
				router.refresh();
			}
		};
		const timer = setInterval(tick, 1000);
		tick();
		return () => clearInterval(timer);
	}, [quota.retryAt, router]);

	const exhausted = quota.remainingMinute === 0 || quota.remainingDay === 0;
	return { blocked: exhausted && secondsLeft !== 0, secondsLeft };
}

export function QuotaLine({ quota, secondsLeft }: { quota: AiQuota; secondsLeft: number | null }) {
	if (quota.remainingDay === 0) {
		return (
			<p role="status" className="text-sm font-semibold text-clay" data-testid="ai-quota">
				Você usou os {quota.limitPerDay} pedidos de hoje. A cota volta à meia-noite UTC (21h em Brasília).
			</p>
		);
	}
	if (quota.remainingMinute === 0) {
		return (
			<p role="status" className="text-sm font-semibold text-clay" data-testid="ai-quota">
				Muitos pedidos em pouco tempo ({quota.limitPerMinute} por minuto).
				{secondsLeft !== null && secondsLeft > 0 ? ` Libera em ${secondsLeft} s.` : ' Liberando…'}
			</p>
		);
	}
	return (
		<p className="text-sm text-stone" data-testid="ai-quota">
			Restam {quota.remainingDay} de {quota.limitPerDay} pedidos hoje (até {quota.limitPerMinute} por minuto).
		</p>
	);
}
