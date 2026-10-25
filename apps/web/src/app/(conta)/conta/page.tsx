import { requirePageUser } from '@/server/auth/session';
import { SignOutButton } from '../_components/sign-out-button';

export const metadata = { title: 'Minha conta · Trilhas SP' };

export default async function AccountPage() {
	const user = await requirePageUser();

	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
			<h1 className="font-display text-3xl font-bold text-forest">Olá, {user.name}</h1>
			<p>{user.email}</p>
			<div>
				<SignOutButton />
			</div>
		</main>
	);
}
