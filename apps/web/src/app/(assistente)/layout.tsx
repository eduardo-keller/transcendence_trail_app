import type { ReactNode } from 'react';
import { AssistantTabs } from './_components/assistant-tabs';

// Páginas do assistente de IA (planejador e perguntas). Provisório até o layout da Juh ter a navegação.
export default function AssistantLayout({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
			<AssistantTabs />
			{children}
		</div>
	);
}
