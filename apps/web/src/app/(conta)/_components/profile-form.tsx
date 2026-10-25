'use client';

import { useState, useTransition } from 'react';
import { BIO_MAX, profileSchema } from '@/lib/validation/profile';
import { fieldErrors } from '@/lib/validation/auth';
import { updateProfileAction } from '@/server/profile/actions';
import { Field, FormError, SubmitButton } from './field';

type Props = { name: string; username: string; bio: string | null };

export function ProfileForm(initial: Props) {
	const [pending, startTransition] = useTransition();
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string>();
	const [saved, setSaved] = useState(false);

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = profileSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		setFormError(undefined);
		setSaved(false);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});

		startTransition(async () => {
			const result = await updateProfileAction(parsed.data);
			if ('error' in result) return setFormError(result.error.message);
			setSaved(true);
		});
	}

	return (
		<form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
			<Field label="Nome" name="name" defaultValue={initial.name} autoComplete="name" error={errors.name} />
			<Field label="Nome de usuário" name="username" defaultValue={initial.username} error={errors.username} />
			<label className="flex flex-col gap-1">
				<span className="font-semibold">Bio</span>
				<textarea
					name="bio"
					defaultValue={initial.bio ?? ''}
					maxLength={BIO_MAX}
					rows={3}
					aria-invalid={errors.bio ? true : undefined}
					className="rounded-lg border border-sand bg-paper px-3 py-2 outline-none focus:border-forest"
				/>
				{errors.bio && <span className="text-sm text-clay">{errors.bio}</span>}
			</label>
			<FormError message={formError} />
			{saved && (
				<p role="status" className="text-sm font-semibold text-moss">
					Perfil salvo.
				</p>
			)}
			<div>
				<SubmitButton pending={pending}>Salvar perfil</SubmitButton>
			</div>
		</form>
	);
}
