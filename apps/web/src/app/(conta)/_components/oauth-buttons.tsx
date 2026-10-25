'use client';

import { useState, useTransition } from 'react';
import { linkAccountAction, oauthSignInAction } from '@/server/auth/oauth-actions';
import { FormError } from './field';

type Props = { providers: { id: string; label: string }[]; mode: 'signin' | 'link' };

export function OAuthButtons({ providers, mode }: Props) {
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string>();
	if (providers.length === 0) return null;

	function go(provider: string) {
		setError(undefined);
		startTransition(async () => {
			// Sucesso: a action redireciona para o provedor
			const action = mode === 'signin' ? oauthSignInAction : linkAccountAction;
			const result = await action(provider);
			if ('error' in result) setError(result.error.message);
		});
	}

	return (
		<div className="flex flex-col gap-2">
			{providers.map((provider) => (
				<button
					key={provider.id}
					type="button"
					disabled={pending}
					onClick={() => go(provider.id)}
					className="rounded-full border border-ink px-5 py-2 font-bold disabled:opacity-60"
				>
					{mode === 'signin' ? `Entrar com ${provider.label}` : `Conectar ${provider.label}`}
				</button>
			))}
			<FormError message={error} />
		</div>
	);
}
