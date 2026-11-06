'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
	{ href: '/planejar', label: 'Planejar' },
	{ href: '/perguntar', label: 'Perguntar' },
];

export function AssistantTabs() {
	const pathname = usePathname();
	return (
		<nav aria-label="Assistente" className="flex flex-wrap items-center gap-2 text-sm font-bold">
			<Link href="/" className="mr-2 text-stone underline">
				Início
			</Link>
			{TABS.map((tab) => (
				<Link
					key={tab.href}
					href={tab.href}
					aria-current={pathname === tab.href ? 'page' : undefined}
					className="rounded-full border border-sand px-4 py-1 text-forest aria-[current=page]:bg-forest aria-[current=page]:text-paper"
				>
					{tab.label}
				</Link>
			))}
		</nav>
	);
}
