/**
 * Chat Socket Handler
 * Handles real-time text messages, emoji reactions, and system notifications.
 */

const { hashRoomCode } = require('../utils/hash');

let Message;
try { Message = require('../models/Message'); } catch (_) { }

module.exports = (io, socket, roomStore) => {
    // ── chat:send ─────────────────────────────────────────────────────────────
    socket.on('chat:send', async ({ roomCode, content, replyTo, e2ee }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
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
            replyTo: replyTo || null,
            e2ee: !!e2ee,
            createdAt: new Date().toISOString(),
        };

        // Store in in-memory buffer (keep last 500 messages)
        room.messages = room.messages || [];
        room.messages.push(message);
        if (room.messages.length > 500) room.messages.shift();

        // Persist to MongoDB asynchronously (non-blocking)
        const hashedCode = hashRoomCode(code);
        if (Message) {
            Message.create({
                roomId: hashedCode,
                userId,
                username,
                avatar,
                content: trimmed,
                type: 'text',
                replyTo: replyTo || null,
            }).catch((err) => console.error('[chat:persist]', err.message));
        }

        // Broadcast to all in room including sender
        io.to(hashedCode).emit('chat:message', message);
    });

    // ── chat:reaction ─────────────────────────────────────────────────────────
    // Floating emoji reaction on video (not persisted)
    socket.on('chat:reaction', ({ roomCode, emoji, e2ee }) => {
        const code = roomCode?.toUpperCase();
        if (!roomStore.has(code)) return;
        const { username, avatar } = socket.user;
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('chat:reaction', {
            id: `rxn_${Date.now()}`,
            username,
            avatar,
            emoji,
            e2ee: !!e2ee,
            timestamp: Date.now(),
        });
    });

    // ── chat:typing ───────────────────────────────────────────────────────────
    // Notifies others that a user is typing (volatile, not persisted)
    socket.on('chat:typing', ({ roomCode }) => {
        const code = roomCode?.toUpperCase();
        if (!code) return;
        const hashedCode = hashRoomCode(code);
        // Broadcast to everyone ELSE in the room
        socket.to(hashedCode).emit('chat:typing', {
            username: socket.user.username,
            timestamp: Date.now()
        });
    });

    // ── chat:message-reaction ─────────────────────────────────────────────────
    // Reaction to a specific chat message (WhatsApp style)
    socket.on('chat:message-reaction', ({ roomCode, messageId, emoji, e2ee }) => {
        const code = roomCode?.toUpperCase();
        if (!roomStore.has(code)) return;
        const hashedCode = hashRoomCode(code);
        
        // Broadcast to everyone in the room
        io.to(hashedCode).emit('chat:message-reaction', {
            messageId,
            emoji,
            username: socket.user.username,
            timestamp: Date.now(),
            e2ee: !!e2ee
        });
    });

    /**
     * Broadcasts a system notification to the room (join/leave/host change).
     * Called externally from the main socket index.
     */
    socket.sendSystemMessage = async (roomCode, content) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return;

        const message = {
            id: `sys_${Date.now()}`,
            roomId: code,
            userId: 'system',
            username: 'System',
            avatar: null,
            content,
            type: 'system',
            createdAt: new Date().toISOString(),
        };

        room.messages = room.messages || [];
        room.messages.push(message);

        const hashedCode = hashRoomCode(code);
        if (Message) {
            Message.create({ roomId: hashedCode, userId: 'system', username: 'System', content, type: 'system' })
                .catch(() => { });
        }

        io.to(hashedCode).emit('chat:message', message);
    };
};
