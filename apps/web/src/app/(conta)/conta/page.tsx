import { requirePageUser } from '@/server/auth/session';

// Provisória: só prova que a página exige login. As telas de conta vêm depois.
export default async function AccountPage() {
	const user = await requirePageUser();

	return (
		<main>
			<h1>Olá, {user.name}</h1>
			<p>{user.email}</p>
		</main>
	);
}
