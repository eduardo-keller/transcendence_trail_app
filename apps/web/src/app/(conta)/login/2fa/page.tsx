import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { AuthCard } from '../../_components/auth-card';
import { LoginTwoFactorForm } from '../../_components/login-two-factor-form';

export const metadata = { title: 'Verificação em duas etapas · Trilhas SP' };

export default async function LoginTwoFactorPage() {
	if (await getSession()) redirect('/conta');
	return (
		<AuthCard title="Verificação em duas etapas">
			<LoginTwoFactorForm />
		</AuthCard>
	);
}
