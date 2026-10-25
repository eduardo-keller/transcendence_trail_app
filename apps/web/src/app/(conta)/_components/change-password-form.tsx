'use client';

import { useState, useTransition } from 'react';
import { changePasswordSchema, fieldErrors, PASSWORD_MIN } from '@/lib/validation/auth';
import { changePasswordAction } from '@/server/auth/actions';
import { Field, FormError, SubmitButton } from './field';

export function ChangePasswordForm() {
	const [pending, startTransition] = useTransition();
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string>();

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = changePasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		setFormError(undefined);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});

		startTransition(async () => {
			// Sucesso: a action redireciona para /conta?aviso=senha-trocada
			const result = await changePasswordAction(parsed.data);
			if ('error' in result) setFormError(result.error.message);
		});
	}

	return (
		<form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
			<Field label="Senha atual" name="currentPassword" type="password" autoComplete="current-password" error={errors.currentPassword} />
			<Field
				label={`Nova senha (mínimo ${PASSWORD_MIN} caracteres)`}
				name="newPassword"
				type="password"
				autoComplete="new-password"
				error={errors.newPassword}
			/>
			<Field label="Repita a nova senha" name="confirmPassword" type="password" autoComplete="new-password" error={errors.confirmPassword} />
			<FormError message={formError} />
			<div>
				<SubmitButton pending={pending}>Trocar senha</SubmitButton>
			</div>
		</form>
	);
}
