import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { AuthCard } from '../_components/auth-card';
import { SignInForm } from '../_components/sign-in-form';

export const metadata = { title: 'Entrar · Trilhas SP' };

export default async function LoginPage() {
	if (await getSession()) redirect('/conta');
	return (
		<AuthCard title="Entrar">
			<SignInForm />
		</AuthCard>
	);
}
