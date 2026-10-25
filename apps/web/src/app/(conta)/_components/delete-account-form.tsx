'use client';

import { useState, useTransition } from 'react';
import { requestAccountDeletionAction } from '@/server/privacy/actions';
import { Field, FormError, SubmitButton } from './field';

export function DeleteAccountForm({ withPassword }: { withPassword: boolean }) {
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string>();
	const [sentTo, setSentTo] = useState<string>();

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const password = String(new FormData(event.currentTarget).get('password') ?? '');
		setError(undefined);
		if (withPassword && !password) return setError('Digite a sua senha.');
		startTransition(async () => {
			const result = await requestAccountDeletionAction({ password });
			if ('error' in result) return setError(result.error.message);
			setSentTo(result.data.email);
		});
	}

	if (sentTo) {
		return (
			<p role="status" className="font-semibold text-moss">
				Enviamos um link de confirmação para {sentTo}. Abra-o neste navegador para concluir a exclusão.
			</p>
		);
	}

	return (
		<form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
			<p>
				Apaga a sua conta e <strong>todos</strong> os seus dados: perfil, foto, trilhas que você criou, atividades e sessões.
				Não dá para desfazer.
			</p>
			{withPassword && <Field label="Confirme a sua senha" name="password" type="password" autoComplete="current-password" />}
			<FormError message={error} />
			<div>
				<SubmitButton pending={pending}>Excluir minha conta</SubmitButton>
			</div>
		</form>
	);
}
