import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { AuthCard } from '../_components/auth-card';
import { SignUpForm } from '../_components/sign-up-form';

export const metadata = { title: 'Criar conta · Trilhas SP' };

export default async function SignUpPage() {
	if (await getSession()) redirect('/conta');
	return (
		<AuthCard title="Criar conta">
			<SignUpForm />
		</AuthCard>
	);
}
