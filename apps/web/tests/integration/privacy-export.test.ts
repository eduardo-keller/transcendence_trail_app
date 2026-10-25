import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { buildDataExport } from '@/server/privacy/export';
import { createUser, resetDatabase } from '../helpers/db';

beforeEach(resetDatabase);

describe('baixar meus dados (GDPR)', () => {
	it('traz perfil, avatar e 2FA, e nenhum segredo', async () => {
		const ana = await createUser('Ana');
		await prisma.user.update({ where: { id: ana.id }, data: { username: 'ana', bio: 'Oi', twoFactorEnabled: true } });
		await prisma.account.create({
			data: { id: 'acc', accountId: ana.id, providerId: 'credential', userId: ana.id, password: 'salt:HASH-SECRETO' },
		});
		await prisma.session.create({
			data: { id: 'ses', token: 'TOKEN-SECRETO', userId: ana.id, expiresAt: new Date('2030-01-01'), updatedAt: new Date() },
		});
		await prisma.twoFactor.create({ data: { id: 'tf', secret: 'SEGREDO-TOTP', backupCodes: 'CODIGOS', userId: ana.id } });
		await prisma.avatar.create({ data: { userId: ana.id, mime: 'image/webp', data: new Uint8Array([1, 2, 3]) } });

		const data = await buildDataExport(ana.id);
		expect(data.profile).toMatchObject({ name: 'Ana', username: 'ana', bio: 'Oi', twoFactorEnabled: true });
		expect(data.avatar).toMatchObject({ mime: 'image/webp', base64: 'AQID' });
		const text = JSON.stringify(data);
		for (const secret of ['HASH-SECRETO', 'TOKEN-SECRETO', 'SEGREDO-TOTP', 'CODIGOS']) expect(text).not.toContain(secret);
	});
});
