'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSocket } from '@/components/socket-provider';

export function RealtimeRefresh() {
	const socket = useSocket();
	const router = useRouter();

	useEffect(() => {
		if (!socket) return;
		const onNotification = () => router.refresh();
		socket.on('notification', onNotification);
		socket.on('notification:read', onNotification);
		socket.io.on('reconnect', onNotification);
		return () => {
			socket.off('notification', onNotification);
			socket.off('notification:read', onNotification);
			socket.io.off('reconnect', onNotification);
		};
	}, [socket, router]);
	return null;
}
