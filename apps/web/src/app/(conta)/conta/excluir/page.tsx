import Link from 'next/link';
import { requirePageUser } from '@/server/auth/session';
import { AuthCard } from '../../_components/auth-card';
import { ConfirmDeletion } from '../../_components/confirm-deletion';

export const metadata = { title: 'Confirmar exclusão · Trilhas SP' };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ConfirmDeletionPage({ searchParams }: Props) {
	const user = await requirePageUser();
	const { token = '' } = await searchParams;

	return (
		<AuthCard title="Excluir a conta">
			<p className="mb-4">
				Você está prestes a apagar a conta de <strong>{user.email}</strong> e todos os seus dados. Não dá para desfazer.
			</p>
			<ConfirmDeletion token={token} />
			<Link href="/conta" className="mt-4 inline-block text-sm font-bold text-forest underline">
				Cancelar
			</Link>
		</AuthCard>
	);
}
