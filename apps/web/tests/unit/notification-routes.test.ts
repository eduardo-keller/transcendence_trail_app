import { describe, expect, it } from 'vitest';
import { notificationHref, usernameTargetIds } from '@/server/notification/routes';

const usernames = new Map([['id-alice', 'alice']]);

describe('notificationHref[FRIEND_REQUEST]', () => {
	it('pedido de amizade leva ao perfil de quem pediu', () => {
		expect(notificationHref({ type: 'FRIEND_REQUEST', targetId: 'id-alice' }, usernames)).toBe('/u/alice');
	});
});

describe('notificationHref[FRIEND_ACCEPTED]', () => {
	it('pedido aceito leva ao perfil de quem aceitou', () => {
		expect(notificationHref({ type: 'FRIEND_ACCEPTED', targetId: 'id-alice' }, usernames)).toBe('/u/alice');
	});
});

describe('notificationHref[FRIEND_DECLINED]', () => {
	it('pedido aceito leva ao perfil de quem rejeitou', () => {
		expect(notificationHref({ type: 'FRIEND_DECLINED', targetId: 'id-alice' }, usernames)).toBeNull();
	});
});

describe('notificationHref[sem link - id-apagado]', () => {
	it('sem link quando a pessoa foi apagada', () => {
		expect(notificationHref({ type: 'FRIEND_REQUEST', targetId: 'id-apagado' }, usernames)).toBeNull();
	});
});

describe('sem link quando nao ha targetId', () => {
	it('sem link quando nao ha targetId', () => {
		expect(notificationHref({ type: 'FRIEND_REQUEST', targetId: null }, usernames)).toBeNull();
	});
});

describe('usernameTargetIds', () => {
	it('devolve só os ids dos tipos que precisam de username', () => {
		const ids = usernameTargetIds([
			{ type: 'FRIEND_REQUEST', targetId: 'id-pediu' },
			{ type: 'FRIEND_ACCEPTED', targetId: 'id-aceitou' },
			{ type: 'FRIEND_DECLINED', targetId: 'id-recusou' },
			{ type: 'FRIEND_REQUEST', targetId: null },
			{ type: 'GENERAL', targetId: null },
		]);
		expect(ids).toEqual(['id-pediu', 'id-aceitou']);
	});
});
