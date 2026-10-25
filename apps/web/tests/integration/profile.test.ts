import type { User } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { removeAvatar, saveAvatar } from '@/server/profile/avatar';
import { updateProfileAction } from '@/server/profile/actions';
import { getPublicProfile } from '@/server/profile/service';
import { createUser, resetDatabase } from '../helpers/db';
import { signInAs } from '../helpers/session';

vi.mock('@/server/auth/session', () => import('../helpers/session'));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const webp = new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0))));

let ana: User;
let bia: User;

beforeEach(async () => {
	await resetDatabase();
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	await prisma.user.update({ where: { id: bia.id }, data: { username: 'bia' } });
});

describe('perfil', () => {
	it('o perfil público nunca traz o e-mail', async () => {
		const profile = await getPublicProfile('BIA');
		expect(profile?.name).toBe('Bia');
		expect(profile).not.toHaveProperty('email');
	});

	it('edita só o perfil de quem está logado', async () => {
		signInAs({ id: ana.id, username: 'x' } as never);
		const result = await updateProfileAction({ name: 'Ana Souza', username: 'Ana_SP', bio: '' });
		expect(result.ok).toBe(true);
		expect(await prisma.user.findUnique({ where: { id: ana.id } })).toMatchObject({ name: 'Ana Souza', username: 'ana_sp', bio: null });
		expect(await prisma.user.findUnique({ where: { id: bia.id } })).toMatchObject({ name: 'Bia', username: 'bia' });
	});

	it('username de outra pessoa → 409, sem alterar nada', async () => {
		signInAs({ id: ana.id, username: 'x' } as never);
		const result = await updateProfileAction({ name: 'Ana', username: 'bia', bio: '' });
		expect(result).toMatchObject({ ok: false, error: { code: 'USERNAME_TAKEN' } });
		expect((await prisma.user.findUnique({ where: { id: ana.id } }))?.username).not.toBe('bia');
	});

	it('sem login → 401', async () => {
		signInAs(null);
		const result = await updateProfileAction({ name: 'Ana', username: 'ana', bio: '' });
		expect(result).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
	});
});

describe('avatar', () => {
	it('recusa arquivo que não é imagem, mesmo com nome e tipo de PNG', async () => {
		const fake = new File(['MZ executável'], 'foto.png', { type: 'image/png' });
		await expect(saveAvatar(ana.id, fake)).rejects.toMatchObject({ status: 400 });
		expect(await prisma.avatar.count()).toBe(0);
	});

	it('recusa arquivo grande demais', async () => {
		const big = new File([webp, new Uint8Array(600 * 1024)], 'grande.webp', { type: 'image/webp' });
		await expect(saveAvatar(ana.id, big)).rejects.toMatchObject({ status: 400 });
	});

	it('guarda o tipo detectado pelo conteúdo e aponta User.image para a rota', async () => {
		const image = await saveAvatar(ana.id, new File([webp], 'qualquer.jpg', { type: 'image/jpeg' }));
		expect(image).toMatch(new RegExp(`^/api/avatar/${ana.id}\\?v=\\d+$`));
		expect((await prisma.avatar.findUnique({ where: { userId: ana.id } }))?.mime).toBe('image/webp');
		expect((await prisma.user.findUnique({ where: { id: ana.id } }))?.image).toBe(image);
	});

	it('remover apaga a imagem e volta ao avatar padrão', async () => {
		await saveAvatar(ana.id, new File([webp], 'a.webp'));
		await removeAvatar(ana.id);
		expect(await prisma.avatar.count()).toBe(0);
		expect((await prisma.user.findUnique({ where: { id: ana.id } }))?.image).toBeNull();
	});

	it('apagar a conta apaga o avatar (cascata)', async () => {
		await saveAvatar(ana.id, new File([webp], 'a.webp'));
		await prisma.user.delete({ where: { id: ana.id } });
		expect(await prisma.avatar.count()).toBe(0);
	});
});
