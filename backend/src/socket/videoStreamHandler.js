/**
 * videoStreamHandler.js
 *
 * Dedicated WebRTC signaling relay for live video streaming.
 * Completely separate from the voice channel — video is automatically
 * received by ALL room participants without needing to join voice.
 *
 * Flow:
 *   Host starts stream → emit video-stream:announce
 *   Server relays → video-stream:announced to all room members
 *   Participants respond with video-stream:request (offer) to host
 *   Host answers with video stream tracks → participants see video
 */
const { hashRoomCode } = require('../utils/hash');

module.exports = (io, socket, roomStore) => {
    // ── video-stream:announce ──────────────────────────────────────────────────
    // Host emits this when starting a live stream, or when a new user joins.
    // Server relays to ALL room members (or a specific target) so they auto-connect.
    socket.on('video-stream:announce', ({ roomCode, targetSocketId }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        const hashedCode = hashRoomCode(code);

        if (targetSocketId) {
            // Tell a specific new socket to initiate a video connection
            io.to(targetSocketId).emit('video-stream:announced', { hostSocketId: socket.id });
        } else {
            // Tell all OTHER sockets in the room to initiate a video connection
            socket.to(hashedCode).emit('video-stream:announced', { hostSocketId: socket.id });
        }
    });

    // ── video-stream:request-announce ─────────────────────────────────────────
    // Late-joining participant asks the host to re-announce the stream.
    // Broadcast to the room — the host's onRequestAnnounce handler picks it up.
    socket.on('video-stream:request-announce', ({ roomCode }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('video-stream:request-announce', { fromSocketId: socket.id });
    });

    // ── video-stream:ended ─────────────────────────────────────────────────────
    // Host emits this when the live stream stops.
    socket.on('video-stream:ended', ({ roomCode }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('video-stream:ended');
    });

    // ── video-stream:tracks-replaced ──────────────────────────────────────────
    // Host emits this after using replaceTrack() on existing PCs (seamless switch).
    // Relay to all participants so they can nudge playback if video element paused.
    socket.on('video-stream:tracks-replaced', ({ roomCode }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('video-stream:tracks-replaced');
    });

    // ── Peer-to-peer relays (host ↔ participant) ───────────────────────────────
    // These are simple relays — the server never inspects the SDP/ICE payloads.

    socket.on('video-stream:offer', ({ targetSocketId, offer, e2ee }) => {
        io.to(targetSocketId).emit('video-stream:offer', {
            fromSocketId: socket.id, offer, e2ee
        });
    });

    socket.on('video-stream:answer', ({ targetSocketId, answer, e2ee }) => {
        io.to(targetSocketId).emit('video-stream:answer', {
            fromSocketId: socket.id, answer, e2ee
        });
    });

    socket.on('video-stream:ice', ({ targetSocketId, candidate, e2ee }) => {
        io.to(targetSocketId).emit('video-stream:ice', {
            fromSocketId: socket.id, candidate, e2ee
        });
    });
};
