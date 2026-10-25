'use client';

import { useTransition } from 'react';
import { signOutAction } from '@/server/auth/actions';

export function SignOutButton() {
	const [pending, startTransition] = useTransition();

	return (
		<button
			type="button"
			disabled={pending}
			onClick={() =>
				startTransition(async () => {
					await signOutAction();
				})
			}
			className="rounded-full border border-forest px-5 py-2 font-bold text-forest disabled:opacity-60"
		>
			{pending ? 'Saindo…' : 'Sair'}
		</button>
	);
}
