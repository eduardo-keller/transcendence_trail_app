import Link from 'next/link';
import { AuthCard } from '../_components/auth-card';

export const metadata = { title: 'Conta excluída · Trilhas SP' };

export default function AccountDeletedPage() {
	return (
		<AuthCard title="Conta excluída">
			<p className="mb-4">A sua conta e todos os seus dados foram apagados. Enviamos uma confirmação por e-mail.</p>
			<Link href="/" className="font-bold text-forest underline">
				Voltar ao início
			</Link>
		</AuthCard>
	);
}
