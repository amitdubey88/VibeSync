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
module.exports = (io, socket, roomStore) => {
    // ── voice:join ────────────────────────────────────────────────────────────
    // Client announces they want to join the voice channel.
    socket.on('voice:join', ({ roomCode }) => {
        const room = roomStore.get(roomCode);
        if (!room) return;

        room.voiceParticipants = room.voiceParticipants || [];

        // Avoid duplicate entries
        if (!room.voiceParticipants.find((p) => p.socketId === socket.id)) {
            room.voiceParticipants.push({
                socketId: socket.id,
                userId: socket.user.id,
                username: socket.user.username,
                avatar: socket.user.avatar,
                isMuted: false,
            });
        }

        // Notify all OTHER voice participants that a new peer arrived.
        // They will initiate WebRTC offers toward the newcomer.
        socket.to(roomCode).emit('voice:user-joined', {
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
        io.to(roomCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
    });

    // ── voice:offer ───────────────────────────────────────────────────────────
    // Forward WebRTC offer to the target peer
    socket.on('voice:offer', ({ targetSocketId, offer, roomCode }) => {
        io.to(targetSocketId).emit('voice:offer', {
            fromSocketId: socket.id,
            fromUserId: socket.user.id,
            fromUsername: socket.user.username,
            offer,
            roomCode,
        });
    });

    // ── voice:answer ──────────────────────────────────────────────────────────
    socket.on('voice:answer', ({ targetSocketId, answer }) => {
        io.to(targetSocketId).emit('voice:answer', {
            fromSocketId: socket.id,
            answer,
        });
    });

    // ── voice:ice-candidate ───────────────────────────────────────────────────
    socket.on('voice:ice-candidate', ({ targetSocketId, candidate }) => {
        io.to(targetSocketId).emit('voice:ice-candidate', {
            fromSocketId: socket.id,
            candidate,
        });
    });

    // ── voice:mute-toggle ─────────────────────────────────────────────────────
    socket.on('voice:mute-toggle', ({ roomCode, isMuted }) => {
        const room = roomStore.get(roomCode);
        if (!room) return;

        const participant = (room.voiceParticipants || []).find((p) => p.socketId === socket.id);
        if (participant) {
            participant.isMuted = isMuted;
            io.to(roomCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
        }
    });

    // ── voice:leave ───────────────────────────────────────────────────────────
    socket.on('voice:leave', ({ roomCode }) => {
        const room = roomStore.get(roomCode);
        if (!room) return;

        room.voiceParticipants = (room.voiceParticipants || []).filter(
            (p) => p.socketId !== socket.id
        );

        // Notify peers to close connection with this socket
        socket.to(roomCode).emit('voice:user-left', { socketId: socket.id });
        io.to(roomCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
    });

    // Exported cleanup called on socket disconnect
    socket.cleanupVoice = (roomCode) => {
        const room = roomStore.get(roomCode);
        if (!room) return;
        room.voiceParticipants = (room.voiceParticipants || []).filter(
            (p) => p.socketId !== socket.id
        );
        socket.to(roomCode).emit('voice:user-left', { socketId: socket.id });
        io.to(roomCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
    };
};
