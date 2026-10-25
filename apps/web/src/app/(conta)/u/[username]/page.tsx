import { notFound } from 'next/navigation';
import { getActivityStats } from '@/server/activities/service';
import { getPublicProfile } from '@/server/profile/service';
import { Avatar } from '../../_components/avatar';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
	const profile = await getPublicProfile((await params).username);
	return { title: profile ? `${profile.name} (@${profile.username}) · Trilhas SP` : 'Perfil não encontrado' };
}

const since = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });

export default async function PublicProfilePage({ params }: Props) {
	const profile = await getPublicProfile((await params).username);
	if (!profile) notFound();
	const stats = await getActivityStats(profile.id);

	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
			<header className="flex items-center gap-4">
				<Avatar id={profile.id} name={profile.name} image={profile.image} size={112} />
				<div>
					<h1 className="font-display text-3xl font-bold text-forest">{profile.name}</h1>
					<p className="text-stone">
						@{profile.username} · na Trilhas SP desde {since.format(profile.createdAt)}
					</p>
				</div>
			</header>
			{profile.bio && <p className="whitespace-pre-line">{profile.bio}</p>}
			<dl className="grid grid-cols-3 gap-3 text-center">
				<Stat label="atividades" value={String(stats.activities)} />
				<Stat label="km percorridos" value={(stats.distance / 1000).toFixed(1)} />
				<Stat label="horas de trilha" value={(stats.duration / 3600).toFixed(1)} />
			</dl>
		</main>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-card bg-paper p-4">
			<dd className="font-display text-2xl font-bold">{value}</dd>
			<dt className="text-sm text-stone">{label}</dt>
		</div>
	);
}
