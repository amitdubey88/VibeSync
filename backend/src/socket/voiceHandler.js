/**
 * WebRTC Voice Signaling Handler
 *
 * Architecture: Full-mesh peer connections via Socket.IO signaling.
 * Each client that joins voice connects directly to every other voice participant.
 *
 * Signal flow:
 *   Peer A joins → server notifies all others → others send offers to A
 *   → A answers → ICE candidates exchanged → direct P2P audio established
 */
const { hashRoomCode } = require('../utils/hash');

module.exports = (io, socket, roomStore) => {
    // ── voice:join ────────────────────────────────────────────────────────────
    // Client announces they want to join the voice channel.
    socket.on('voice:join', ({ roomCode, passive }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;

        room.voiceParticipants = room.voiceParticipants || [];

        // Avoid duplicate entries (reconnects change socket.id; userId is stable)
        let participant = room.voiceParticipants.find((p) => p.userId === socket.user.id);
        if (!participant) {
            participant = {
                socketId: socket.id,
                userId: socket.user.id,
                username: socket.user.username,
                avatar: socket.user.avatar,
                isMuted: false,
                isPassive: !!passive,
            };
            room.voiceParticipants.push(participant);
        } else {
            // Re-join/reconnect: update socket + status
            participant.socketId = socket.id;
            participant.isPassive = !!passive;
            participant.username = socket.user.username;
            participant.avatar = socket.user.avatar;
        }

        const hashedCode = hashRoomCode(code);
        // Notify all OTHER voice participants that a new peer arrived.
        // They will initiate WebRTC offers toward the newcomer.
        socket.to(hashedCode).emit('voice:user-joined', {
            socketId: socket.id,
            userId: socket.user.id,
            username: socket.user.username,
            avatar: socket.user.avatar,
        });

        // Send the newcomer the list of existing voice participants so they know
        // who to expect offers from.
        socket.emit('voice:participants', {
            participants: room.voiceParticipants.filter((p) => p.socketId !== socket.id),
        });

        // Broadcast updated voice list to whole room
        io.to(hashedCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
    });

    // ── voice:offer ───────────────────────────────────────────────────────────
    // Forward WebRTC offer to the target peer
    socket.on('voice:offer', ({ targetSocketId, offer, roomCode, e2ee }) => {
        io.to(targetSocketId).emit('voice:offer', {
            fromSocketId: socket.id,
            fromUserId: socket.user.id,
            fromUsername: socket.user.username,
            offer,
            roomCode,
            e2ee: !!e2ee,
        });
    });

    // ── voice:answer ──────────────────────────────────────────────────────────
    socket.on('voice:answer', ({ targetSocketId, answer, e2ee }) => {
        io.to(targetSocketId).emit('voice:answer', {
            fromSocketId: socket.id,
            answer,
            e2ee: !!e2ee,
        });
    });

    // ── voice:ice-candidate ───────────────────────────────────────────────────
    socket.on('voice:ice-candidate', ({ targetSocketId, candidate, e2ee }) => {
        io.to(targetSocketId).emit('voice:ice-candidate', {
            fromSocketId: socket.id,
            candidate,
            e2ee: !!e2ee,
        });
    });

    // ── voice:mute-toggle ─────────────────────────────────────────────────────
    socket.on('voice:mute-toggle', ({ roomCode, isMuted }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;

        const participant = (room.voiceParticipants || []).find((p) => p.userId === socket.user.id);
        if (participant) {
            participant.isMuted = isMuted;
            const hashedCode = hashRoomCode(code);
            io.to(hashedCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
        }
    });

    // ── voice:leave ───────────────────────────────────────────────────────────
    socket.on('voice:leave', ({ roomCode }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;

        room.voiceParticipants = (room.voiceParticipants || []).filter(
            (p) => p.userId !== socket.user.id
        );

        // Notify peers to close connection with this socket
        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('voice:user-left', { socketId: socket.id });
        io.to(hashedCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
    });

    // ── voice:premier-started ──────────────────────────────────────────────────
    // Host emits this when starting a live stream / screen share.
    // The server relays it to ALL other room members so they close their stale
    // peer connections and re-announce via voice:join, triggering fresh connections
    // that include the video track from the start.
    socket.on('voice:premier-started', ({ roomCode }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        const hashedCode = hashRoomCode(code);
        // Relay to everyone else in the room (not the host who emitted it)
        socket.to(hashedCode).emit('voice:premier-started');
        console.log(`[voice] Premier stream started by ${socket.user.username} in ${code}`);
    });

    // Exported cleanup called on socket disconnect
    socket.cleanupVoice = (roomCode) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        room.voiceParticipants = (room.voiceParticipants || []).filter(
            (p) => p.userId !== socket.user.id
        );
        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('voice:user-left', { socketId: socket.id });
        io.to(hashedCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
    };
};
