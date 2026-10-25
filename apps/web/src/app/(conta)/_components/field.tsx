import type { InputHTMLAttributes } from 'react';

// Provisório até o design system da Juh: input com rótulo e mensagem de erro
type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string };

export function Field({ label, name, error, ...input }: Props) {
	const errorId = `${name}-error`;
	return (
		<label className="flex flex-col gap-1">
			<span className="font-semibold">{label}</span>
			<input
				name={name}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				className="rounded-lg border border-sand bg-paper px-3 py-2 outline-none focus:border-forest aria-invalid:border-clay"
				{...input}
			/>
			{error && (
				<span id={errorId} className="text-sm text-clay">
					{error}
				</span>
			)}
		</label>
	);
}

export function FormError({ message }: { message?: string }) {
	if (!message) return null;
	return (
		<p role="alert" className="rounded-lg bg-sand px-3 py-2 text-sm text-ink">
			{message}
		</p>
	);
}

export function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
	return (
		<button
			type="submit"
			disabled={pending}
			className="rounded-full bg-forest px-5 py-2 font-bold text-paper disabled:opacity-60"
		>
			{pending ? 'Aguarde…' : children}
		</button>
	);
}
