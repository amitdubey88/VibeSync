'use client';

import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/**
 * useClockSync
 * 
 * Establishes a unified clock with the server to mathematically negate
 * network latency when timing events.
 * 
 * Exposes `window.serverOffset` which represents the difference between 
 * the local system clock and the authoritative server clock in milliseconds.
 */
const useClockSync = () => {
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!socket || !isConnected) return;

        // Ensure offset exists
        if (typeof window.serverOffset === 'undefined') {
            window.serverOffset = 0;
        }

        const handlePong = ({ clientTime, serverTime }) => {
            const now = Date.now();
            const roundTripTime = now - clientTime;
            const latency = roundTripTime / 2;

            // Offset is how far ahead/behind the server is compared to our clock
            // serverTime + latency = approximate actual time on server RIGHT NOW
            window.serverOffset = (serverTime + latency) - now;
        };

        socket.on('sync:pong', handlePong);

        // Ping the server to measure offset
        const pingInterval = setInterval(() => {
            socket.emit('sync:ping', { clientTime: Date.now() });
        }, 10000); // Ping every 10 seconds to keep accuracy tight in case of clock drift

        // Initial ping immediately
        socket.emit('sync:ping', { clientTime: Date.now() });

        return () => {
            socket.off('sync:pong', handlePong);
            clearInterval(pingInterval);
        };
    }, [socket, isConnected]);

    return {
        getServerTime: () => Date.now() + (window.serverOffset || 0)
    };
};

export default useClockSync;
