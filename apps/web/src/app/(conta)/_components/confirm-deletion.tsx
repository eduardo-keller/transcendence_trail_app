'use client';

import { useState, useTransition } from 'react';
import { confirmAccountDeletionAction } from '@/server/privacy/actions';
import { FormError } from './field';

export function ConfirmDeletion({ token }: { token: string }) {
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string>();

	return (
		<div className="flex flex-col gap-4">
			<FormError message={error} />
			<button
				type="button"
				disabled={pending}
				onClick={() =>
					startTransition(async () => {
						// Sucesso: a action redireciona para /conta-excluida
						const result = await confirmAccountDeletionAction(token);
						if ('error' in result) setError(result.error.message);
					})
				}
				className="rounded-full bg-clay px-5 py-2 font-bold text-paper disabled:opacity-60"
			>
				{pending ? 'Excluindo…' : 'Excluir definitivamente'}
			</button>
		</div>
	);
}
