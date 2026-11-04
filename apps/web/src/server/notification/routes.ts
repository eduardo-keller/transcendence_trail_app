import type { NotificationType } from '@prisma/client';

type Route = { needs: 'username' | 'nothing'; href: (username?: string) => string | null };

const toProfile = (username?: string) => (username ? `/u/${username}` : null);

const noLink = () => null;

const routes: Record<NotificationType, Route> = {
	GENERAL: { needs: 'nothing', href: noLink },
	FRIEND_REQUEST: { needs: 'username', href: toProfile },
	FRIEND_ACCEPTED: { needs: 'username', href: toProfile },
	FRIEND_DECLINED: { needs: 'nothing', href: noLink },
	FRIEND_REMOVED: { needs: 'nothing', href: noLink },
	MESSAGE: { needs: 'nothing', href: noLink },
};

type NotificationRef = { type: NotificationType; targetId: string | null };

export function usernameTargetIds(notifications: NotificationRef[]): string[] {
	const ids = notifications.filter((n) => routes[n.type].needs === 'username').map((n) => n.targetId);
	return ids.filter((id) => id != null);
}

export function notificationHref(notification: NotificationRef, usernames: Map<string, string>): string | null {
	const route = routes[notification.type];
	if (route.needs === 'nothing' || !notification.targetId) return route.href();
	return route.href(usernames.get(notification.targetId));
}
