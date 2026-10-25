'use client';

import { useTransition } from 'react';
import { revokeOtherSessionsAction, revokeSessionAction } from '@/server/auth/actions';

export type SessionItem = { id: string; device: string; ip: string | null; lastSeen: string; current: boolean };

export function SessionsList({ sessions }: { sessions: SessionItem[] }) {
	const [pending, startTransition] = useTransition();
	const others = sessions.filter((session) => !session.current).length;

	return (
		<div className="flex flex-col gap-3">
			<ul className="flex flex-col gap-2">
				{sessions.map((session) => (
					<li key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand px-3 py-2">
						<div>
							<p className="font-semibold">
								{session.device}
								{session.current && <span className="ml-2 rounded-full bg-moss px-2 text-xs text-paper">este dispositivo</span>}
							</p>
							<p className="text-sm text-stone">
								{session.ip ?? 'IP desconhecido'} · último acesso {session.lastSeen}
							</p>
						</div>
						{!session.current && (
							<button
								type="button"
								disabled={pending}
								onClick={() => startTransition(async () => void (await revokeSessionAction(session.id)))}
								className="text-sm font-bold text-clay disabled:opacity-60"
							>
								Encerrar
							</button>
						)}
					</li>
				))}
			</ul>
			{others > 0 && (
				<div>
					<button
						type="button"
						disabled={pending}
						onClick={() => startTransition(async () => void (await revokeOtherSessionsAction()))}
						className="rounded-full border border-clay px-4 py-1 text-sm font-bold text-clay disabled:opacity-60"
					>
						Encerrar todas as outras ({others})
					</button>
				</div>
			)}
		</div>
	);
}
