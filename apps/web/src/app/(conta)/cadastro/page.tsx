import { redirect } from 'next/navigation';
import { OAUTH_PROVIDERS } from '@/lib/oauth';
import { oauthErrorMessage } from '@/server/auth/oauth-errors';
import { getSession } from '@/server/auth/session';
import { AuthCard } from '../_components/auth-card';
import { FormError } from '../_components/field';
import { OAuthButtons } from '../_components/oauth-buttons';
import { SignUpForm } from '../_components/sign-up-form';

export const metadata = { title: 'Criar conta · Trilhas SP' };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SignUpPage({ searchParams }: Props) {
	const { error } = await searchParams;
	if (await getSession()) redirect('/conta');
	return (
		<AuthCard title="Criar conta">
			<div className="flex flex-col gap-6">
				<FormError message={oauthErrorMessage(error)} />
				<SignUpForm />
				{OAUTH_PROVIDERS.length > 0 && <p className="text-center text-sm text-stone">ou</p>}
				<OAuthButtons providers={OAUTH_PROVIDERS} mode="signin" />
			</div>
		</AuthCard>
	);
}
