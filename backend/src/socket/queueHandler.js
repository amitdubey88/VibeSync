/**
 * Watch Queue Socket Handler
 * New socket events: queue:suggest, queue:approve, queue:remove, queue:reorder
 *
 * On approval, emits video:set-source to trigger host's existing setVideo flow
 * via the room's host socket — does NOT rewrite any sync logic.
 */
const { hashRoomCode } = require('../utils/hash');

module.exports = (io, socket, roomStore) => {
    const isPrivileged = (room) => {
        if (!room) return false;
        if (socket.user.id === room.hostId) return true;
        return (room.coHosts || []).includes(socket.user.id);
    };

    // ── queue:suggest ─────────────────────────────────────────────────────────
    socket.on('queue:suggest', ({ roomCode, video }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return;

        const item = {
            id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            suggestedBy: socket.user.username,
            suggestedById: socket.user.id,
            title: String(video?.title || 'Untitled').slice(0, 100),
            url: String(video?.url || '').slice(0, 2000),
            type: video?.type || 'url',
            status: 'pending', // 'pending' | 'approved' | 'rejected'
            suggestedAt: Date.now(),
        };

        room.watchQueue = room.watchQueue || [];
        room.watchQueue.push(item);

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('queue:updated', { queue: room.watchQueue });
        console.log(`📋 Queue suggestion in ${code}: "${item.title}" by ${socket.user.username}`);
    });

    // ── queue:approve ─────────────────────────────────────────────────────────
    // On approval, triggers host's video:set-source via host socket
    socket.on('queue:approve', ({ roomCode, itemId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !isPrivileged(room)) return socket.emit('error', { message: 'Only host or co-host can approve queue items' });

        const item = (room.watchQueue || []).find(q => q.id === itemId);
        if (!item) return;

        item.status = 'approved';
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('queue:updated', { queue: room.watchQueue });

        // Signal the host's client to load the video via its existing setVideo flow
        const hostParticipant = room.participants.find(p => p.userId === room.hostId && p.isOnline !== false);
        if (hostParticipant) {
            io.to(hostParticipant.socketId).emit('queue:load-video', {
                video: { title: item.title, url: item.url, type: item.type }
            });
        }

        // Remove from queue after approval
        room.watchQueue = room.watchQueue.filter(q => q.id !== itemId);
        io.to(hashedCode).emit('queue:updated', { queue: room.watchQueue });
        console.log(`✅ Queue item approved in ${code}: "${item.title}"`);
    });

    // ── queue:remove ──────────────────────────────────────────────────────────
    socket.on('queue:remove', ({ roomCode, itemId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return;

        const item = (room.watchQueue || []).find(q => q.id === itemId);
        if (!item) return;

        // Host/co-host can remove any item; suggestor can remove their own
        const canRemove = isPrivileged(room) || item.suggestedById === socket.user.id;
        if (!canRemove) return socket.emit('error', { message: 'Permission denied' });

        room.watchQueue = room.watchQueue.filter(q => q.id !== itemId);
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('queue:updated', { queue: room.watchQueue });
    });

    // ── queue:reorder ─────────────────────────────────────────────────────────
    socket.on('queue:reorder', ({ roomCode, orderedIds }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !isPrivileged(room)) return;
        if (!Array.isArray(orderedIds)) return;

        const queueMap = Object.fromEntries((room.watchQueue || []).map(q => [q.id, q]));
        room.watchQueue = orderedIds.map(id => queueMap[id]).filter(Boolean);

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('queue:updated', { queue: room.watchQueue });
    });
};
