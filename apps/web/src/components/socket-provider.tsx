'use client';

import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { RealtimeRefresh } from '@/components/realtime-refresh';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    useEffect(() => {
        const s = io(); setSocket(s);

        s.on('connect', () => console.log("Socket: Connected!\tSID: ", s.id));
        s.on('connect_error', (e) => console.log("Socket: Error!", e.message))

        return () => { s.disconnect(); };
    }, []);
    return (
        <SocketContext value={socket}>
            <RealtimeRefresh />
                {children}
        </SocketContext>
        );
}

export function useSocket() {
    return (use(SocketContext));
}
