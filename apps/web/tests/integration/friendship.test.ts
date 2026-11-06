import type { User } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { acceptFriendRequest, friendshipStatus, listFriends, sendFriendRequest } from '@/server/social/friendship';
import {
	acceptFriendRequestAction,
	declineFriendRequestAction,
	removeFriendAction,
	sendFriendRequestAction,
} from '@/server/social/friendship-actions';
import { createUser, resetDatabase } from '../helpers/db';
import { signInAs } from '../helpers/session';

vi.mock('@/server/auth/session', () => import('../helpers/session'));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let ana: User;
let bia: User;
let carla: User;

beforeEach(async () => {
	await resetDatabase();
	ana = await createUser('Ana');
	bia = await createUser('Bia');
	carla = await createUser('Carla');
});

const notificationsOf = (userId: string) => prisma.notification.findMany({ where: {userId}});

describe('amizade', () => {
	it('pedido e aceite: os dois viram amigos e cada um é notificado', async () => {
		signInAs(ana);
		expect(await sendFriendRequestAction(bia.id)).toEqual({ ok: true, data:'requested' });
		expect(await friendshipStatus(bia.id, ana.id)).toBe('received');
		expect((await notificationsOf(bia.id))[0]).toMatchObject({type: 'FRIEND_REQUEST', targetId: ana.id});
		
		signInAs(bia);
		expect((await acceptFriendRequestAction(ana.id)).ok).toBe(true);
		expect(await friendshipStatus(ana.id,bia.id)).toBe('friends');
		expect((await notificationsOf(ana.id))[0]).toMatchObject({type: 'FRIEND_ACCEPTED', targetId: bia.id});
	});
	
	it('pedido para si mesmo é recusado', async () => {
		signInAs(ana);
		const result = await sendFriendRequestAction(ana.id);
		expect(result.ok === false && result.error.code).toBe('BAD_REQUEST');
	});
	
	it('pedido repetido responde 409', async () => {
		signInAs(ana);
		await sendFriendRequestAction(bia.id);
		const result = await sendFriendRequestAction(bia.id);
		expect(result.ok === false && result.error.code).toBe('CONFLICT');
	});
	
	it('pedido cruzado vira amizade', async () => {
		await sendFriendRequest(ana.id, bia.id);
		expect(await sendFriendRequest(bia.id, ana.id)).toBe('accepted');
		expect(await friendshipStatus(ana.id, bia.id)).toBe('friends');
	});
	
	it('pedidos cruzados ao mesmo tempo viram UMA amizade', async () => {
		const results = await Promise.all([sendFriendRequest(ana.id, bia.id), sendFriendRequest(bia.id, ana.id)]);
		expect(results.sort()).toEqual(['accepted', 'requested']);
		const rows = await prisma.friendship.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe('ACCEPTED');
	});
	
	it('10 aceites sumultâneos: 1 sucesso, o resto 404, nenhum 500', async () => {
		await sendFriendRequest(ana.id, bia.id);
		const results = await Promise.allSettled(Array.from({length: 10}, () => acceptFriendRequest(bia.id, ana.id)));
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		for (const r of results) if (r.status === 'rejected') expect(r.reason.status).toBe(404);
	});
		
	it('quem pediu não pode aceitar o próprio pedido; terceiros também não', async () => {
		await sendFriendRequest(ana.id, bia.id);
		signInAs(ana);
		expect((await acceptFriendRequestAction(bia.id)).ok).toBe(false);
		signInAs(carla);
		expect((await acceptFriendRequestAction(ana.id)).ok).toBe(false);
		expect(await friendshipStatus(ana.id, bia.id)).toBe('sent');
	});
	
	it('recusar apaga o pedido e avisa quem pediu', async () => {
		await sendFriendRequest(ana.id, bia.id);
		signInAs(bia);
		expect((await declineFriendRequestAction(ana.id)).ok).toBe(true);
		expect(await prisma.friendship.count()).toBe(0);
		expect((await notificationsOf(ana.id))[0]).toMatchObject({ type: 'FRIEND_DECLINED', targetId: bia.id });
	});
	
	it('desfazer amizade apaga a linha e avisa o próprio', async () => {
		await sendFriendRequest(ana.id, bia.id);
		await acceptFriendRequest(bia.id, ana.id);
		signInAs(ana);
		expect((await removeFriendAction(bia.id)).ok).toBe(true);
		expect(await friendshipStatus(ana.id, bia.id)).toBe('none');
		expect((await notificationsOf(ana.id))[0]).toMatchObject({ type: 'FRIEND_REMOVED', targetId: bia.id });
	});
	
	it('a lista de amigos nunca traz o e-mail', async () => {
		await sendFriendRequest(ana.id, bia.id);
		await acceptFriendRequest(bia.id, ana.id);
		const friends = await listFriends(ana.id);
		expect(friends.map((f) => f.id)).toEqual([bia.id]);
		expect(friends[0]).not.toHaveProperty('email');
	});
	
	it('pedido para usuário inexistente responde 404', async () => {
		signInAs(ana);
		const result = await sendFriendRequestAction('nao-existe');
		expect('error' in result && result.error.code).toBe('NOT_FOUND');
	});
	
	it('desfazer amizade que não existe responde 404 e não notifica', async () => {
		signInAs(ana);
		const result = await removeFriendAction(bia.id);
		expect('error' in result && result.error.code).toBe('NOT_FOUND');
		expect(await notificationsOf(ana.id)).toHaveLength(0);
	});
	
});
