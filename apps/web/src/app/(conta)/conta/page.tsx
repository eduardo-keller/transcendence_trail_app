import Link from 'next/link';
import { requirePageUser } from '@/server/auth/session';
import { ProfileForm } from '../_components/profile-form';
import { SignOutButton } from '../_components/sign-out-button';

export const metadata = { title: 'Minha conta · Trilhas SP' };

export default async function AccountPage() {
	const user = await requirePageUser();

	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-display text-3xl font-bold text-forest">Olá, {user.name}</h1>
					<p className="text-stone">{user.email}</p>
				</div>
				<SignOutButton />
			</header>

			<section className="rounded-card bg-paper p-6">
				<div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="font-display text-xl font-bold">Perfil</h2>
					<Link href={`/u/${user.username}`} className="text-sm font-bold text-forest underline">
						Ver meu perfil público
					</Link>
				</div>
				<ProfileForm name={user.name} username={user.username} bio={user.bio ?? null} />
			</section>
		</main>
	);
}
