import Link from 'next/link';
import { getSession, requirePageUser } from '@/server/auth/session';
import { OAUTH_PROVIDERS } from '@/lib/oauth';
import { hasPassword, linkedProviders } from '@/server/auth/account';
import { oauthErrorMessage } from '@/server/auth/oauth-errors';
import { describeDevice, listSessions } from '@/server/auth/sessions';
import { Avatar } from '../_components/avatar';
import { AvatarUpload } from '../_components/avatar-upload';
import { ChangePasswordForm } from '../_components/change-password-form';
import { FormError } from '../_components/field';
import { OAuthButtons } from '../_components/oauth-buttons';
import { ProfileForm } from '../_components/profile-form';
import { SessionsList } from '../_components/sessions-list';
import { TwoFactorDisable, TwoFactorSetup } from '../_components/two-factor-setup';
import { SignOutButton } from '../_components/sign-out-button';

export const metadata = { title: 'Minha conta · Trilhas SP' };

const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

type Props = { searchParams: Promise<{ aviso?: string; error?: string }> };

export default async function AccountPage({ searchParams }: Props) {
	const { aviso, error } = await searchParams;
	const user = await requirePageUser();
	const current = await getSession();
	const withPassword = await hasPassword(user.id);
	const linked = await linkedProviders(user.id);
	const notLinked = OAUTH_PROVIDERS.filter((provider) => !linked.includes(provider.id));
	const sessions = (await listSessions(user.id)).map((session) => ({
		id: session.id,
		device: describeDevice(session.userAgent),
		ip: session.ipAddress,
		lastSeen: when.format(session.updatedAt),
		current: session.id === current?.session.id,
	}));

	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<Avatar id={user.id} name={user.name} image={user.image} />
					<div className="flex flex-col gap-1">
						<h1 className="font-display text-3xl font-bold text-forest">Olá, {user.name}</h1>
						<p className="text-stone">{user.email}</p>
						<AvatarUpload hasImage={!!user.image} />
					</div>
				</div>
				<SignOutButton />
			</header>

			<section className="rounded-card bg-paper p-6">
				<div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="font-display text-xl font-bold">Perfil</h2>
					<Link href={`/u/${user.username}`} className="text-sm font-bold text-forest underline">
						Ver meu perfil público
					</Link>
				</div>
				<ProfileForm name={user.name} username={user.username} bio={user.bio ?? null} />
			</section>

			<section className="rounded-card bg-paper p-6">
				<h2 className="mb-4 font-display text-xl font-bold">Senha</h2>
				{aviso === 'senha-trocada' && <Notice>Senha trocada. As outras sessões foram encerradas.</Notice>}
				{withPassword ? <ChangePasswordForm /> : <p>Sua conta entra pelo GitHub ou pela 42 e não tem senha.</p>}
			</section>

			<section className="rounded-card bg-paper p-6">
				<h2 className="mb-4 font-display text-xl font-bold">Verificação em duas etapas</h2>
				{aviso === '2fa-ativado' && <Notice>Verificação em duas etapas ativada.</Notice>}
				{aviso === '2fa-desativado' && <Notice>Verificação em duas etapas desativada.</Notice>}
				{!withPassword ? (
					<p>Sua conta entra pelo GitHub ou pela 42: a segunda etapa fica com o provedor.</p>
				) : user.twoFactorEnabled ? (
					<TwoFactorDisable />
				) : (
					<TwoFactorSetup />
				)}
			</section>

			<section className="rounded-card bg-paper p-6">
				<h2 className="mb-4 font-display text-xl font-bold">Contas conectadas</h2>
				{aviso === 'conta-conectada' && <Notice>Conta conectada.</Notice>}
				<FormError message={oauthErrorMessage(error)} />
				<ul className="mb-4 flex flex-col gap-1" data-testid="linked-accounts">
					{withPassword && <li>E-mail e senha</li>}
					{linked.includes('github') && <li>GitHub</li>}
					{linked.includes('42') && <li>42</li>}
				</ul>
				<OAuthButtons providers={notLinked} mode="link" />
			</section>

			<section className="rounded-card bg-paper p-6">
				<h2 className="mb-4 font-display text-xl font-bold">Sessões ativas</h2>
				<SessionsList sessions={sessions} />
			</section>
		</main>
	);
}

function Notice({ children }: { children: string }) {
	return (
		<p role="status" className="mb-4 text-sm font-semibold text-moss">
			{children}
		</p>
	);
}
