'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { fieldErrors, signInSchema } from '@/lib/validation/auth';
import { signInAction } from '@/server/auth/actions';
import { Field, FormError, SubmitButton } from './field';

export function SignInForm() {
	const [pending, startTransition] = useTransition();
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string>();

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = Object.fromEntries(new FormData(event.currentTarget));
		const parsed = signInSchema.safeParse(data);
		setFormError(undefined);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});

		startTransition(async () => {
			const result = await signInAction(parsed.data);
			// Sucesso: a action redireciona para /conta
			if ('error' in result) setFormError(result.error.message);
		});
	}

	return (
		<form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
			<Field label="E-mail" name="email" type="email" autoComplete="email" error={errors.email} />
			<Field label="Senha" name="password" type="password" autoComplete="current-password" error={errors.password} />
			<FormError message={formError} />
			<SubmitButton pending={pending}>Entrar</SubmitButton>
			<p className="text-sm">
				Ainda não tem conta?{' '}
				<Link href="/cadastro" className="font-bold text-forest underline">
					Cadastre-se
				</Link>
			</p>
		</form>
	);
}
