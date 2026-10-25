'use client';

import { useState, useTransition } from 'react';
import { fieldErrors, passwordConfirmSchema, totpCodeSchema } from '@/lib/validation/auth';
import { confirmTwoFactorAction, disableTwoFactorAction, startTwoFactorAction } from '@/server/auth/two-factor-actions';
import { Field, FormError, SubmitButton } from './field';

type Setup = { uri: string; secret: string; backupCodes: string[] };

export function TwoFactorSetup() {
	const [pending, startTransition] = useTransition();
	const [setup, setSetup] = useState<Setup>();
	const [saved, setSaved] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string>();

	function onPassword(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = passwordConfirmSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		setFormError(undefined);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});
		startTransition(async () => {
			const result = await startTwoFactorAction(parsed.data);
			if ('error' in result) return setFormError(result.error.message);
			setSetup(result.data);
		});
	}

	function onCode(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = totpCodeSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		setFormError(undefined);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});
		startTransition(async () => {
			// Sucesso: a action redireciona para /conta?aviso=2fa-ativado
			const result = await confirmTwoFactorAction(parsed.data);
			if ('error' in result) setFormError(result.error.message);
		});
	}

	if (!setup) {
		return (
			<form onSubmit={onPassword} noValidate className="flex flex-col gap-4">
				<p>Além da senha, o login vai pedir um código de 6 dígitos de um app autenticador (Google Authenticator, Aegis, 1Password…).</p>
				<Field label="Confirme a sua senha" name="password" type="password" autoComplete="current-password" error={errors.password} />
				<FormError message={formError} />
				<div>
					<SubmitButton pending={pending}>Ativar verificação em duas etapas</SubmitButton>
				</div>
			</form>
		);
	}

	return (
		<div className="flex flex-col gap-5">
			<ol className="flex list-decimal flex-col gap-4 pl-5">
				<li>
					No app autenticador, escolha <strong>inserir chave de configuração</strong> e digite a chave abaixo. No celular, dá
					para tocar no link.
					<p className="mt-2 font-mono text-lg tracking-wider" data-testid="totp-secret">
						{setup.secret.match(/.{1,4}/g)?.join(' ')}
					</p>
					<a href={setup.uri} className="text-sm font-bold text-forest underline">
						Abrir no app autenticador
					</a>
				</li>
				<li>
					Guarde os <strong>códigos de recuperação</strong>. Cada um entra uma vez, se você perder o celular. Eles só aparecem
					agora.
					<ul className="mt-2 grid grid-cols-2 gap-1 font-mono sm:grid-cols-5" data-testid="backup-codes">
						{setup.backupCodes.map((code) => (
							<li key={code}>{code}</li>
						))}
					</ul>
					<label className="mt-2 flex items-center gap-2">
						<input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
						Guardei os códigos
					</label>
				</li>
			</ol>
			{saved && (
				<form onSubmit={onCode} noValidate className="flex flex-col gap-4">
					<Field label="Código de 6 dígitos do app" name="code" inputMode="numeric" autoComplete="one-time-code" error={errors.code} />
					<FormError message={formError} />
					<div>
						<SubmitButton pending={pending}>Confirmar e ativar</SubmitButton>
					</div>
				</form>
			)}
		</div>
	);
}

export function TwoFactorDisable() {
	const [pending, startTransition] = useTransition();
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string>();

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = passwordConfirmSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		setFormError(undefined);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});
		startTransition(async () => {
			const result = await disableTwoFactorAction(parsed.data);
			if ('error' in result) setFormError(result.error.message);
		});
	}

	return (
		<form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
			<p className="font-semibold text-moss">Ativada: o login pede o código do app.</p>
			<Field label="Confirme a sua senha para desativar" name="password" type="password" autoComplete="current-password" error={errors.password} />
			<FormError message={formError} />
			<div>
				<SubmitButton pending={pending}>Desativar</SubmitButton>
			</div>
		</form>
	);
}
