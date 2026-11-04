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
		return () => {
			socket.off('notification', onNotification);
		};
	}, [socket, router]);
	return null;
}
