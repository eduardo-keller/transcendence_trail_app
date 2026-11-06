import { planDateRange } from '@/lib/validation/ai';
import { isAiConfigured, isMockProvider } from '@/server/ai/model';
import { getAiQuota } from '@/server/ai/rate-limit';
import { listPlannableTrails } from '@/server/ai/trails';
import { ApiError } from '@/server/api';
import { requirePageUser } from '@/server/auth/session';
import { getTrail } from '@/server/trails/service';
import { PlannerForm } from './planner-form';

export const metadata = { title: 'Planejar trilha · Trilhas SP' };

type Props = { searchParams: Promise<{ trilha?: string | string[] }> };

export default async function PlannerPage({ searchParams }: Props) {
	const user = await requirePageUser();
	const { trilha } = await searchParams;
	const [trails, quota] = await Promise.all([listPlannableTrails(), getAiQuota(user.id)]);

	// ?trilha=<id> pré-seleciona (link "Planejar esta trilha"). Uma trilha fora da lista entra no topo,
	// se o usuário puder vê-la; id inexistente é ignorado.
	let initialTrailId: string | null = null;
	if (typeof trilha === 'string' && trilha) {
		if (trails.some((trail) => trail.id === trilha)) {
			initialTrailId = trilha;
		} else {
			const extra = await getTrail(trilha, user.id).catch((error) => {
				if (error instanceof ApiError) return null;
				throw error;
			});
			if (extra) {
				trails.unshift({ id: extra.id, title: extra.title, distance: extra.distance, difficulty: extra.difficulty });
				initialTrailId = extra.id;
			}
		}
	}

	return (
		<main className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h1 className="font-display text-3xl font-bold text-forest">Planejar uma trilha</h1>
				<p className="text-stone">
					Escolha a trilha, a data e o tempo do grupo: o assistente monta horários, ritmo, o que levar e alertas.
				</p>
				<p className="text-sm text-stone">
					A IA pode errar e não considera a previsão do tempo. Distância, desnível e tempo são estimados a partir do
					OpenStreetMap. Confira as condições antes de sair.
				</p>
				{isMockProvider() && (
					<p className="text-sm font-semibold text-moss">Modo de teste: as respostas são fixas (LLM_PROVIDER=mock).</p>
				)}
			</header>
			<PlannerForm
				trails={trails}
				initialTrailId={initialTrailId}
				dateRange={planDateRange()}
				quota={quota}
				configured={isAiConfigured()}
			/>
		</main>
	);
}
