import type { ReactNode } from 'react';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
			<div className="rounded-card bg-paper p-6 shadow-sm sm:p-8">
				<h1 className="mb-6 font-display text-3xl font-bold text-forest">{title}</h1>
				{children}
			</div>
		</main>
	);
}
