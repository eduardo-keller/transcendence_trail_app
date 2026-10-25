'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { fieldErrors, PASSWORD_MIN, signUpSchema } from '@/lib/validation/auth';
import { signUpAction } from '@/server/auth/actions';
import { Field, FormError, SubmitButton } from './field';

export function SignUpForm() {
	const [pending, startTransition] = useTransition();
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string>();

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = Object.fromEntries(new FormData(event.currentTarget));
		const parsed = signUpSchema.safeParse(data);
		setFormError(undefined);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});

		startTransition(async () => {
			const result = await signUpAction(parsed.data);
			// Sucesso: a action redireciona para /conta
			if ('error' in result) setFormError(result.error.message);
		});
	}

	return (
		<form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
			<Field label="Nome" name="name" autoComplete="name" error={errors.name} />
			<Field label="E-mail" name="email" type="email" autoComplete="email" error={errors.email} />
			<Field
				label={`Senha (mínimo ${PASSWORD_MIN} caracteres)`}
				name="password"
				type="password"
				autoComplete="new-password"
				error={errors.password}
			/>
			<FormError message={formError} />
			<SubmitButton pending={pending}>Criar conta</SubmitButton>
			<p className="text-sm">
				Já tem conta?{' '}
				<Link href="/login" className="font-bold text-forest underline">
					Entrar
				</Link>
			</p>
		</form>
	);
}
