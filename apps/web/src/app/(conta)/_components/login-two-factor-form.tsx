'use client';

import { useState, useTransition } from 'react';
import { backupCodeSchema, fieldErrors, totpCodeSchema } from '@/lib/validation/auth';
import { verifyLoginBackupCodeAction, verifyLoginCodeAction } from '@/server/auth/two-factor-actions';
import { Field, FormError, SubmitButton } from './field';

export function LoginTwoFactorForm() {
	const [pending, startTransition] = useTransition();
	const [useBackup, setUseBackup] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string>();

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const schema = useBackup ? backupCodeSchema : totpCodeSchema;
		const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		setFormError(undefined);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});
		startTransition(async () => {
			// Sucesso: a action redireciona para /conta
			const action = useBackup ? verifyLoginBackupCodeAction : verifyLoginCodeAction;
			const result = await action(parsed.data);
			if ('error' in result) setFormError(result.error.message);
		});
	}

	return (
		<form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
			<Field
				key={useBackup ? 'backup' : 'totp'}
				label={useBackup ? 'Código de recuperação' : 'Código de 6 dígitos do app autenticador'}
				name="code"
				inputMode={useBackup ? 'text' : 'numeric'}
				autoComplete="one-time-code"
				error={errors.code}
			/>
			<FormError message={formError} />
			<SubmitButton pending={pending}>Verificar</SubmitButton>
			<button type="button" onClick={() => setUseBackup(!useBackup)} className="text-left text-sm font-bold text-forest underline">
				{useBackup ? 'Usar o código do app' : 'Perdi o celular: usar um código de recuperação'}
			</button>
		</form>
	);
}
