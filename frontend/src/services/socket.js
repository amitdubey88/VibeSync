import { io } from 'socket.io-client';

let socket = null;

/**
 * Connect to the Socket.IO server with the user's JWT token.
 * Returns the singleton socket instance.
 */
export const connectSocket = (token) => {
    if (socket?.connected) return socket;

    const SERVER_URL = import.meta.env.VITE_API_URL || '/';
    socket = io(SERVER_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
    });

    socket.on('connect', () => console.log('🔌 Socket connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
    socket.on('connect_error', (err) => console.error('🔌 Socket error:', err.message));

    return socket;
};

/**
 * Disconnect and clear the socket singleton.
 */
export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

/**
 * Get the current socket instance (may be null if not connected).
 */
export const getSocket = () => socket;

export default { connectSocket, disconnectSocket, getSocket };
