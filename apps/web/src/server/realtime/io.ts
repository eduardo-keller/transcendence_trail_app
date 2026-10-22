import type { Server } from 'socket.io';

export function getIO(): Server | undefined {
	return (globalThis as { io?: Server }).io;
}
