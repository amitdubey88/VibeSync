/**
 * Video Sync Socket Handler
 *
 * Architecture:
 * - HOST-AUTHORITATIVE: Only the user with hostId emits playback events.
 * - Server caches latest videoState for late-joiner sync.
 * - Drift correction is handled on the client side (>1.5s = hard seek).
 */

const { hashRoomCode } = require('../utils/hash');

module.exports = (io, socket, roomStore) => {
    const getRoomAndValidateHost = (roomCode) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return { error: 'Room not found' };
        const room = roomStore.get(code);
        if (!room) return { error: 'Room not found' };
        
        const isHost = socket.user?.id === room.hostId;
        const isCoHost = (room.coHosts || []).includes(socket.user?.id);
        
        if (!isHost && !isCoHost) {
            return { error: 'Only the host or co-host can control playback' };
        }
        
        return { room, code };
    };

    // ── video:set-uploading ───────────────────────────────────────────────────
    // Host started a local upload — participants see a "waiting" state.
    socket.on('video:set-uploading', ({ roomCode, title }) => {
        const { room, code, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.currentVideo = { type: 'uploading', title, url: null };
        // Keep videoState running (host is playing locally)
        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('video:uploading', { title });
        console.log(`[sync] Upload started in ${code}: ${title}`);
    });

    // ── video:set-source ─────────────────────────────────────────────────────
    // Host sets or changes the video source. When called after a background upload,
    // currentTime + isPlaying are passed so participants join at the right position.
    socket.on('video:set-source', ({ roomCode, video, currentTime, isPlaying }) => {
        const { room, code, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.currentVideo = video;
        // Preserve playback position if provided (background upload scenario)
        const t = (typeof currentTime === 'number') ? currentTime : 0;
        // Note: duration is synced separately via video:sync-duration — not part of set-source payload
        const playing = isPlaying ?? false;
        room.videoState = { currentTime: t, duration: 0, isPlaying: playing, lastUpdated: Date.now() };

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

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('video:source-changed', { video, videoState: room.videoState });
        console.log(`[sync] Source changed in ${code}: ${video?.title} @${t.toFixed(2)}s`);
    });

    // ── video:play ────────────────────────────────────────────────────────────
    socket.on('video:play', ({ roomCode, currentTime }) => {
        const { room, code, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.videoState = { ...room.videoState, currentTime, isPlaying: true, lastUpdated: Date.now() };

        // Broadcast to all OTHER clients (host already played locally)
        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('video:play', { currentTime, timestamp: Date.now() });
        console.log(`[sync] PLAY @${currentTime.toFixed(2)}s in room ${code}`);
    });

    // ── video:pause ───────────────────────────────────────────────────────────
    socket.on('video:pause', ({ roomCode, currentTime }) => {
        const { room, code, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.videoState = { ...room.videoState, currentTime, isPlaying: false, lastUpdated: Date.now() };

        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('video:pause', { currentTime });
        console.log(`[sync] PAUSE @${currentTime.toFixed(2)}s in room ${code}`);
    });

    // ── video:seek ────────────────────────────────────────────────────────────
    socket.on('video:seek', ({ roomCode, currentTime }) => {
        const { room, code, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        room.videoState.currentTime = currentTime;
        room.videoState.lastUpdated = Date.now();

        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('video:seek', { currentTime });
        console.log(`[sync] SEEK @${currentTime.toFixed(2)}s in room ${code}`);
    });

    // ── video:heartbeat ───────────────────────────────────────────────────────
    // Host continuously transmits authority playback timestamp
    socket.on('video:heartbeat', ({ roomCode, currentTime, isPlaying, rate, timestamp }) => {
        const { room, code, error } = getRoomAndValidateHost(roomCode);
        if (error) return; // Silent fail for heartbeats to prevent log spam

        room.videoState.currentTime = currentTime;
        room.videoState.isPlaying = isPlaying;
        room.videoState.lastUpdated = Date.now();

        const hashedCode = hashRoomCode(code);
        socket.to(hashedCode).emit('video:sync', { currentTime, isPlaying, rate, timestamp });
    });

    // ── video:drift-report ────────────────────────────────────────────────────
    // Guests report their current drift. Server routes this telemetry to the host
    // to drive adaptive sync frequency scaling.
    socket.on('video:drift-report', ({ roomCode, drift }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        
        // Find the host's socket ID — participants use userId, not id
        const hostParticipant = room.participants.find(p => p.userId === room.hostId);
        if (hostParticipant && hostParticipant.socketId) {
            io.to(hostParticipant.socketId).emit('video:client-drift', { drift });
        }
    });

    // ── video:sync-duration ───────────────────────────────────────────────────
    // Host reports the duration of a newly loaded video/stream.
    socket.on('video:sync-duration', ({ roomCode, duration }) => {
        const { room, code, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        // Update the duration without causing a full source change event
        if (room.videoState) {
            room.videoState.duration = duration;
        } else {
            room.videoState = { currentTime: 0, isPlaying: false, duration, lastUpdated: Date.now() };
        }

        const hashedCode = hashRoomCode(code);
        // We can just blast out a state update request. Clients handle onSyncState
        io.to(hashedCode).emit('video:source-changed', { video: room.currentVideo, videoState: room.videoState });
        console.log(`[sync] Duration synced @${duration.toFixed(2)}s in room ${code}`);
    });

    // ── video:request-sync ────────────────────────────────────────────────────
    // Called by late joiners or reconnecting clients to get current state.
    // Server calculates the adjusted currentTime based on elapsed wall-clock time.
    socket.on('video:request-sync', ({ roomCode }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;

        const { videoState, currentVideo } = room;

        // Guard: videoState may be null if no video has been loaded in this room yet
        if (!videoState) {
            socket.emit('video:sync-state', {
                currentVideo: currentVideo || null,
                videoState: { currentTime: 0, duration: 0, isPlaying: false, lastUpdated: Date.now() },
            });
            return;
        }

        let adjustedTime = videoState.currentTime || 0;

        // If video was playing, account for time elapsed since last update
        if (videoState.isPlaying && videoState.lastUpdated) {
            const elapsedSec = (Date.now() - videoState.lastUpdated) / 1000;
            adjustedTime = (videoState.currentTime || 0) + elapsedSec;
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
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        const participant = room.participants.find((p) => p.socketId === socket.id);
        if (participant) {
            participant.isBuffering = true;
            const hashedCode = hashRoomCode(code);
            io.to(hashedCode).emit('room:participant-update', { participants: room.participants });
        }
    });

    // ── video:buffer-end ──────────────────────────────────────────────────────
    socket.on('video:buffer-end', ({ roomCode }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room) return;
        const participant = room.participants.find((p) => p.socketId === socket.id);
        if (participant) {
            participant.isBuffering = false;
            const hashedCode = hashRoomCode(code);
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

    // ── subtitles:set (Feature 11) ────────────────────────────────────────────
    // Host broadcasts SRT cue data; server relays to all participants.
    socket.on('subtitles:set', ({ roomCode, cues }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room || socket.user.id !== room.hostId) return;
        const hashedCode = require('../utils/hash').hashRoomCode(code);
        socket.to(hashedCode).emit('subtitles:set', { cues });
    });

    // ── subtitles:clear (Feature 11) ─────────────────────────────────────────
    socket.on('subtitles:clear', ({ roomCode }) => {
        const code = roomCode?.toUpperCase?.();
        if (!code) return;
        const room = roomStore.get(code);
        if (!room || socket.user.id !== room.hostId) return;
        const hashedCode = require('../utils/hash').hashRoomCode(code);
        socket.to(hashedCode).emit('subtitles:clear');
    });

    // ── video:set-speed (Feature 12 — Speed Vote) ─────────────────────────────
    // Host broadcasts the agreed-upon playback rate to all participants.
    // Clients listen for 'video:speed-changed' and apply it to their video element.
    socket.on('video:set-speed', ({ roomCode, speed }) => {
        const { code, error } = getRoomAndValidateHost(roomCode);
        if (error) return socket.emit('error', { message: error });

        const VALID_SPEEDS = [0.75, 1, 1.25, 1.5, 2];
        if (!VALID_SPEEDS.includes(Number(speed))) return;

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('video:speed-changed', { speed: Number(speed) });
        console.log(`[sync] Speed set to ${speed}x in room ${code}`);
    });
};
