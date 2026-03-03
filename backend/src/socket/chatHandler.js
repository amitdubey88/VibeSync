/**
 * Chat Socket Handler
 * Handles real-time text messages, emoji reactions, and system notifications.
 */

let Message;
try { Message = require('../models/Message'); } catch (_) { }

module.exports = (io, socket, roomStore) => {
    // ── chat:send ─────────────────────────────────────────────────────────────
    socket.on('chat:send', async ({ roomCode, content }) => {
        const room = roomStore.get(roomCode);
        if (!room) return;

        // Sanitize content
        const trimmed = (content || '').trim().slice(0, 2000);
        if (!trimmed) return;

        const { id: userId, username, avatar } = socket.user;

        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            roomId: roomCode,
            userId,
            username,
            avatar,
            content: trimmed,
            type: 'text',
            createdAt: new Date().toISOString(),
        };

        // Store in in-memory buffer (keep last 500 messages)
        room.messages = room.messages || [];
        room.messages.push(message);
        if (room.messages.length > 500) room.messages.shift();

        // Persist to MongoDB asynchronously (non-blocking)
        if (Message) {
            Message.create({
                roomId: roomCode,
                userId,
                username,
                avatar,
                content: trimmed,
                type: 'text',
            }).catch((err) => console.error('[chat:persist]', err.message));
        }

        // Broadcast to all in room including sender
        io.to(roomCode).emit('chat:message', message);
    });

    // ── chat:reaction ─────────────────────────────────────────────────────────
    // Floating emoji reaction on video (not persisted)
    socket.on('chat:reaction', ({ roomCode, emoji }) => {
        if (!roomStore.has(roomCode)) return;
        const { username, avatar } = socket.user;
        io.to(roomCode).emit('chat:reaction', {
            id: `rxn_${Date.now()}`,
            username,
            avatar,
            emoji,
            timestamp: Date.now(),
        });
    });

    /**
     * Broadcasts a system notification to the room (join/leave/host change).
     * Called externally from the main socket index.
     */
    socket.sendSystemMessage = async (roomCode, content) => {
        const room = roomStore.get(roomCode);
        if (!room) return;

        const message = {
            id: `sys_${Date.now()}`,
            roomId: roomCode,
            userId: 'system',
            username: 'System',
            avatar: null,
            content,
            type: 'system',
            createdAt: new Date().toISOString(),
        };

        room.messages = room.messages || [];
        room.messages.push(message);

        if (Message) {
            Message.create({ roomId: roomCode, userId: 'system', username: 'System', content, type: 'system' })
                .catch(() => { });
        }

        io.to(roomCode).emit('chat:message', message);
    };
};
