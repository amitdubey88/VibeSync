/**
 * Chat Socket Handler
 * Handles real-time text messages, emoji reactions, and system notifications.
 */

const { hashRoomCode } = require('../utils/hash');

let Message;
try { Message = require('../models/Message'); } catch { /* Fallback */ }

module.exports = (io, socket, roomStore) => {
    // ── chat:send ─────────────────────────────────────────────────────────────
    socket.on('chat:send', async ({ roomCode, content, replyTo, e2ee }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return;

        // Sanitize content
        const trimmed = (content || '').trim().slice(0, 2000);
        if (!trimmed) return;

        // ── Slow Mode check (Feature 4) ───────────────────────────────────────
        if (room.slowMode?.enabled && socket.user.id !== room.hostId) {
            const cooldown = room.slowMode.cooldown * 1000;
            const lastSent = room.slowMode.lastSentAt?.[socket.user.id] || 0;
            if (Date.now() - lastSent < cooldown) {
                const remaining = Math.ceil((cooldown - (Date.now() - lastSent)) / 1000);
                return socket.emit('room:slowmode:blocked', { remaining });
            }
            room.slowMode.lastSentAt = room.slowMode.lastSentAt || {};
            room.slowMode.lastSentAt[socket.user.id] = Date.now();
        }

        // ── Word Filter check (Feature 5) — asterisk banned words ────────────
        let filteredContent = trimmed;
        if (!e2ee && room.bannedWords?.length) {
            room.bannedWords.forEach(word => {
                if (!word) return;
                const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                filteredContent = filteredContent.replace(new RegExp(escaped, 'gi'), '*'.repeat(word.length));
            });
        }

        const { id: userId, username, avatar } = socket.user;

        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            roomId: roomCode,
            userId,
            username,
            avatar,
            content: filteredContent,
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
                id: message.id,
                roomId: hashedCode,
                userId,
                username,
                avatar,
                content: trimmed,
                type: 'text',
                replyTo: replyTo || null,
                e2ee: !!e2ee,
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
    // Reaction to a specific chat message 
    socket.on('chat:message-reaction', async ({ roomCode, messageId, emoji, e2ee }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return;
        const hashedCode = hashRoomCode(code);
        
        // Update in-memory store
        if (room.messages) {
            const msg = room.messages.find(m => m.id === messageId);
            if (msg) {
                msg.reactions = msg.reactions || {};
                
                // 1. Remove user from ALL existing reactions on this message
                Object.keys(msg.reactions).forEach(e => {
                    msg.reactions[e] = (msg.reactions[e] || []).filter(u => u !== socket.user.username);
                    if (msg.reactions[e].length === 0) delete msg.reactions[e];
                });

                // 2. Add as new reaction (unless toggling the same emoji off, but here we enforce "chooses another = changes")
                // Toggle logic: if it was already that specific emoji, it's already removed above. 
                // If it was a DIFFERENT emoji, it's removed above and we add it now.
                // We need to check if it WAS present in the specific emoji to support "tap again to remove"
                const users = msg.reactions[emoji] || [];
                msg.reactions[emoji] = [...users, socket.user.username];
            }
        }

        // Persist to DB
        if (Message) {
            try {
                const msg = await Message.findOne({ id: messageId });
                if (msg) {
                    const currentReactions = msg.reactions || new Map();
                    
                    // Remove user from all reaction keys
                    for (let [e, users] of currentReactions.entries()) {
                        const filtered = users.filter(u => u !== socket.user.username);
                        if (filtered.length === 0) currentReactions.delete(e);
                        else currentReactions.set(e, filtered);
                    }

                    // Add new reaction
                    const users = currentReactions.get(emoji) || [];
                    currentReactions.set(emoji, [...users, socket.user.username]);
                    
                    msg.reactions = currentReactions;
                    await msg.save();
                }
            } catch (err) {
                console.error('[chat:reaction-persist]', err.message);
            }
        }

        // Broadcast to everyone in the room
        io.to(hashedCode).emit('chat:message-reaction', {
            messageId,
            emoji,
            username: socket.user.username,
            timestamp: Date.now(),
            e2ee: !!e2ee
        });
    });

    // ── chat:delivered ────────────────────────────────────────────────────────
    // Participant ACKs receipt of one or more messages. Host and sender get notified.
    socket.on('chat:delivered', ({ roomCode, messageIds }) => {
        const code = roomCode?.toUpperCase();
        if (!roomStore.has(code)) return;
        const hashedCode = hashRoomCode(code);
        // Broadcast to the room so the sender's client can update tick state
        socket.to(hashedCode).emit('chat:delivered', {
            messageIds,
            username: socket.user.username,
        });
    });

    // ── chat:read ─────────────────────────────────────────────────────────────
    // Participant marks messages as seen (chat panel is open and active).
    socket.on('chat:read', ({ roomCode, messageIds }) => {
        const code = roomCode?.toUpperCase();
        if (!roomStore.has(code)) return;
        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('chat:read', {
            messageIds,
            username: socket.user.username,
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
