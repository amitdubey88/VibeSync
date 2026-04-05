import { io } from 'socket.io-client';

let socket = null;
let currentToken = null;

/**
 * Connect to the Socket.IO server with the user's JWT token.
 * If already connected with the SAME token, returns the existing socket.
 * If the token changed (new login / username change), disconnects first and reconnects.
 */
export const connectSocket = (token) => {
    // If same token and still connected — reuse
    if (socket?.connected && currentToken === token) return socket;

    // Different token or disconnected — tear down old connection first
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    currentToken = token;

    const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
    currentToken = null;
};

/**
 * Get the current socket instance (may be null if not connected).
 */
export const getSocket = () => socket;

export default { connectSocket, disconnectSocket, getSocket };
