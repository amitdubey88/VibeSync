/**
 * Video Sync Socket Handler
 *
 * Architecture:
 * - HOST-AUTHORITATIVE: Only the user with hostId emits playback events.
 * - Server caches latest videoState for late-joiner sync.
 * - Drift correction is handled on the client side (>1.5s = hard seek).
 */

const { hashRoomCode } = require('../utils/hash');

let Message;
try { Message = require('../models/Message'); } catch (_) { }

module.exports = (io, socket, roomStore) => {
    const getRoomAndValidateHost = (roomCode) => {
        const room = roomStore.get(roomCode);
        if (!room) return { error: 'Room not found' };
        if (socket.user?.id !== room.hostId) return { error: 'Only the host can control playback' };
        return { room };
    };

    // ── video:set-uploading ───────────────────────────────────────────────────
    // Host started a local upload — participants see a "waiting" state.
    socket.on('video:set-uploading', ({ roomCode, title }) => {
        const { room, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.currentVideo = { type: 'uploading', title, url: null };
        // Keep videoState running (host is playing locally)
        const hashedCode = hashRoomCode(roomCode);
        socket.to(hashedCode).emit('video:uploading', { title });
        console.log(`[sync] Upload started in ${roomCode}: ${title}`);
    });

    // ── video:set-source ─────────────────────────────────────────────────────
    // Host sets or changes the video source. When called after a background upload,
    // currentTime + isPlaying are passed so participants join at the right position.
    socket.on('video:set-source', ({ roomCode, video, currentTime, isPlaying }) => {
        const { room, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.currentVideo = video;
        // Preserve playback position if provided (background upload scenario)
        const t = (typeof currentTime === 'number') ? currentTime : 0;
        const dur = (typeof duration === 'number') ? duration : 0;
        const playing = isPlaying ?? false;
        room.videoState = { currentTime: t, duration: dur, isPlaying: playing, lastUpdated: Date.now() };

        // Record video history for cleanup on room deletion
        if (video && video.url && (video.type === 'file' || video.type === 'url')) {
            const systemMsg = {
                id: `vsys_${Date.now()}`,
                userId: 'system', username: 'System', avatar: null,
                content: `Video set to: ${video.title || 'Untitled'}`,
                type: 'system',
                videoUrl: video.url, // Hidden field used for deep cleanup
                createdAt: new Date().toISOString(),
            };
            room.messages = room.messages || [];
            room.messages.push(systemMsg);
        }

        const hashedCode = hashRoomCode(roomCode);
        io.to(hashedCode).emit('video:source-changed', { video, videoState: room.videoState });
        console.log(`[sync] Source changed in ${roomCode}: ${video?.title} @${t.toFixed(2)}s`);
    });

    // ── video:play ────────────────────────────────────────────────────────────
    socket.on('video:play', ({ roomCode, currentTime }) => {
        const { room, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.videoState = { ...room.videoState, currentTime, isPlaying: true, lastUpdated: Date.now() };

        // Broadcast to all OTHER clients (host already played locally)
        const hashedCode = hashRoomCode(roomCode);
        socket.to(hashedCode).emit('video:play', { currentTime, timestamp: Date.now() });
        console.log(`[sync] PLAY @${currentTime.toFixed(2)}s in room ${roomCode}`);
    });

    // ── video:pause ───────────────────────────────────────────────────────────
    socket.on('video:pause', ({ roomCode, currentTime }) => {
        const { room, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.videoState = { ...room.videoState, currentTime, isPlaying: false, lastUpdated: Date.now() };

        const hashedCode = hashRoomCode(roomCode);
        socket.to(hashedCode).emit('video:pause', { currentTime });
        console.log(`[sync] PAUSE @${currentTime.toFixed(2)}s in room ${roomCode}`);
    });

    // ── video:seek ────────────────────────────────────────────────────────────
    socket.on('video:seek', ({ roomCode, currentTime }) => {
        const { room, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.videoState.currentTime = currentTime;
        room.videoState.lastUpdated = Date.now();

        const hashedCode = hashRoomCode(roomCode);
        socket.to(hashedCode).emit('video:seek', { currentTime });
        console.log(`[sync] SEEK @${currentTime.toFixed(2)}s in room ${roomCode}`);
    });

    // ── video:heartbeat ───────────────────────────────────────────────────────
    // Host continuously transmits authority playback timestamp
    socket.on('video:heartbeat', ({ roomCode, currentTime, isPlaying, rate, timestamp }) => {
        const { room, error } = getRoomAndValidateHost(roomCode);
        if (error) return; // Silent fail for heartbeats to prevent log spam

        room.videoState.currentTime = currentTime;
        room.videoState.isPlaying = isPlaying;
        room.videoState.lastUpdated = Date.now();

        const hashedCode = hashRoomCode(roomCode);
        socket.to(hashedCode).emit('video:sync', { currentTime, isPlaying, rate, timestamp });
    });

    // ── video:drift-report ────────────────────────────────────────────────────
    // Guests report their current drift. Server routes this telemetry to the host
    // to drive adaptive sync frequency scaling.
    socket.on('video:drift-report', ({ roomCode, drift }) => {
        const room = roomStore.get(roomCode);
        if (!room) return;
        
        // Find the host's socket ID
        const hostParticipant = room.participants.find(p => p.id === room.hostId);
        if (hostParticipant && hostParticipant.socketId) {
            io.to(hostParticipant.socketId).emit('video:client-drift', { drift });
        }
    });

    // ── video:sync-duration ───────────────────────────────────────────────────
    // Host reports the duration of a newly loaded video/stream.
    socket.on('video:sync-duration', ({ roomCode, duration }) => {
        const { room, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        // Update the duration without causing a full source change event
        if (room.videoState) {
            room.videoState.duration = duration;
        } else {
            room.videoState = { currentTime: 0, isPlaying: false, duration, lastUpdated: Date.now() };
        }

        const hashedCode = hashRoomCode(roomCode);
        // We can just blast out a state update request. Clients handle onSyncState
        io.to(hashedCode).emit('video:source-changed', { video: room.currentVideo, videoState: room.videoState });
        console.log(`[sync] Duration synced @${duration.toFixed(2)}s in room ${roomCode}`);
    });

    // ── video:request-sync ────────────────────────────────────────────────────
    // Called by late joiners or reconnecting clients to get current state.
    // Server calculates the adjusted currentTime based on elapsed wall-clock time.
    socket.on('video:request-sync', ({ roomCode }) => {
        const room = roomStore.get(roomCode);
        if (!room) return;

        const { videoState, currentVideo } = room;
        let adjustedTime = videoState.currentTime;

        // If video was playing, account for time elapsed since last update
        if (videoState.isPlaying) {
            const elapsedSec = (Date.now() - videoState.lastUpdated) / 1000;
            adjustedTime = videoState.currentTime + elapsedSec;
        }

        socket.emit('video:sync-state', {
            currentVideo,
            videoState: {
                ...videoState,
                currentTime: adjustedTime,
            },
        });
    });

    // ── video:buffer-start ────────────────────────────────────────────────────
    // Client notifies others that they are buffering. Host can choose to pause.
    socket.on('video:buffer-start', ({ roomCode }) => {
        const room = roomStore.get(roomCode);
        if (!room) return;
        const participant = room.participants.find((p) => p.socketId === socket.id);
        if (participant) {
            participant.isBuffering = true;
            const hashedCode = hashRoomCode(roomCode);
            io.to(hashedCode).emit('room:participant-update', { participants: room.participants });
        }
    });

    // ── video:buffer-end ──────────────────────────────────────────────────────
    socket.on('video:buffer-end', ({ roomCode }) => {
        const room = roomStore.get(roomCode);
        if (!room) return;
        const participant = room.participants.find((p) => p.socketId === socket.id);
        if (participant) {
            participant.isBuffering = false;
            const hashedCode = hashRoomCode(roomCode);
            io.to(hashedCode).emit('room:participant-update', { participants: room.participants });
        }
    });

    // ── sync:ping ─────────────────────────────────────────────────────────────
    // Used by clients to calculate network latency and server clock offset
    socket.on('sync:ping', ({ clientTime }) => {
        socket.emit('sync:pong', {
            clientTime,
            serverTime: Date.now()
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // WebRTC DataChannel Signaling (P2P Sync Fallback/Override)
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('sync-channel:offer', ({ targetSocketId, offer }) => {
        socket.to(targetSocketId).emit('sync-channel:offer', {
            offer,
            fromSocketId: socket.id
        });
    });

    socket.on('sync-channel:answer', ({ targetSocketId, answer }) => {
        socket.to(targetSocketId).emit('sync-channel:answer', {
            answer,
            fromSocketId: socket.id
        });
    });

    socket.on('sync-channel:ice', ({ targetSocketId, candidate }) => {
        socket.to(targetSocketId).emit('sync-channel:ice', {
            candidate,
            fromSocketId: socket.id
        });
    });
};
