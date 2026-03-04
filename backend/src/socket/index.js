/**
 * Socket.IO Main Index
 *
 * Registers all socket handlers, manages room join/leave lifecycle,
 * and handles authentication via JWT from socket handshake.
 */
const jwt = require('jsonwebtoken');
const syncHandler = require('./syncHandler');
const chatHandler = require('./chatHandler');
const voiceHandler = require('./voiceHandler');
const roomActionsHandler = require('./roomActionsHandler');

module.exports = (io, roomStore) => {
    // ── Auth Middleware ────────────────────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));
        try {
            socket.user = jwt.verify(token, process.env.JWT_SECRET);
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Connected: ${socket.user.username} (${socket.id})`);

        // Register domain handlers
        syncHandler(io, socket, roomStore);
        chatHandler(io, socket, roomStore);
        voiceHandler(io, socket, roomStore);
        roomActionsHandler(io, socket, roomStore);

        // Current room this socket belongs to
        let currentRoomCode = null;

        // ── room:get-participants ──────────────────────────────────────────────
        // Client can request a fresh participant list at any time
        socket.on('room:get-participants', ({ roomCode }) => {
            const code = roomCode?.toUpperCase();
            const room = roomStore.get(code);
            if (!room) return;
            socket.emit('room:participant-update', { participants: room.participants });
        });

        // ── room:set-approval ──────────────────────────────────────────────────
        // Host toggles whether new joins need approval
        socket.on('room:set-approval', ({ roomCode, requiresApproval }) => {
            const code = roomCode?.toUpperCase();
            const room = roomStore.get(code);
            if (!room || room.hostId !== socket.user.id) return;
            room.requiresApproval = !!requiresApproval;
            io.to(code).emit('room:approval-changed', { requiresApproval: room.requiresApproval });
        });

        // ── room:approve-join ──────────────────────────────────────────────────
        socket.on('room:approve-join', ({ roomCode, userId }) => {
            const code = roomCode?.toUpperCase();
            const room = roomStore.get(code);
            if (!room || room.hostId !== socket.user.id) return;

            const pending = (room.pendingJoins || []).find((p) => p.userId === userId);
            if (!pending) return;

            // Remove from pending
            room.pendingJoins = room.pendingJoins.filter((p) => p.userId !== userId);

            // Add to participants
            room.participants.push({
                socketId: pending.socketId,
                userId: pending.userId,
                username: pending.username,
                avatar: pending.avatar,
                isGuest: pending.isGuest,
                isOnline: true,
                isBuffering: false,
                joinedAt: Date.now(),
            });

            // Send full state to the approved user
            io.to(pending.socketId).emit('room:state', {
                room: {
                    code: room.code, name: room.name, hostId: room.hostId,
                    type: room.type, participantLimit: room.participantLimit,
                    currentVideo: room.currentVideo,
                    videoState: computeAdjustedVideoState(room.videoState),
                    participants: room.participants,
                    voiceParticipants: room.voiceParticipants || [],
                    requiresApproval: room.requiresApproval || false,
                },
            });

            // Broadcast updated participant list
            io.to(code).emit('room:participant-update', { participants: room.participants });

            const msg = {
                id: `sys_${Date.now()}`, userId: 'system', username: 'System',
                avatar: null, content: `${pending.username} joined the room`, type: 'system',
                createdAt: new Date().toISOString()
            };
            room.messages = room.messages || [];
            room.messages.push(msg);
            io.to(code).emit('chat:message', msg);

            console.log(`✅ ${pending.username} approved into room ${code}`);
        });

        // ── room:deny-join ─────────────────────────────────────────────────────
        socket.on('room:deny-join', ({ roomCode, userId }) => {
            const code = roomCode?.toUpperCase();
            const room = roomStore.get(code);
            if (!room || room.hostId !== socket.user.id) return;

            const pending = (room.pendingJoins || []).find((p) => p.userId === userId);
            if (!pending) return;

            room.pendingJoins = room.pendingJoins.filter((p) => p.userId !== userId);
            io.to(pending.socketId).emit('room:join-denied', { message: 'The host declined your request to join.' });
            console.log(`❌ ${pending.username} denied from room ${code}`);
        });

        // ── room:join ──────────────────────────────────────────────────────────
        socket.on('room:join', ({ roomCode }) => {
            const code = roomCode?.toUpperCase();
            const room = roomStore.get(code);
            if (!room) return socket.emit('error', { message: 'Room not found' });

            // Leave previous room if any
            if (currentRoomCode && currentRoomCode !== code) {
                leaveRoom(currentRoomCode);
            }

            currentRoomCode = code;
            socket.join(code);

            // Add participant if not already present
            const existing = room.participants.find((p) => p.userId === socket.user.id);
            if (existing) {
                existing.socketId = socket.id; // Update socket ID on reconnect
                existing.isOnline = true;
            } else {
                // ── Username conflict check ───────────────────────────────────────
                const nameTaken = room.participants.find(
                    (p) => p.username.toLowerCase() === socket.user.username.toLowerCase() && p.isOnline !== false
                );
                if (nameTaken) {
                    socket.leave(code);
                    currentRoomCode = null;
                    return socket.emit('room:join-error', {
                        message: `Username "${socket.user.username}" is already taken in this room. Please choose a different name.`,
                    });
                }

                // ── Approval gate (skip for the host themselves) ──────────────────
                const isRoomHost = socket.user.id === room.hostId;
                if (room.requiresApproval && !isRoomHost) {
                    // Keep socket in room channel so they can receive the approval event
                    room.pendingJoins = room.pendingJoins || [];
                    room.pendingJoins.push({
                        socketId: socket.id,
                        userId: socket.user.id,
                        username: socket.user.username,
                        avatar: socket.user.avatar,
                        isGuest: socket.user.isGuest || false,
                    });

                    // Notify the joiner they're waiting
                    socket.emit('room:join-pending', { message: 'Waiting for host to approve your request…' });

                    // Notify the host
                    const hostParticipant = room.participants.find((p) => p.userId === room.hostId && p.isOnline);
                    if (hostParticipant) {
                        io.to(hostParticipant.socketId).emit('room:join-request', {
                            userId: socket.user.id,
                            username: socket.user.username,
                            avatar: socket.user.avatar,
                            isGuest: socket.user.isGuest || false,
                        });
                    }

                    console.log(`⏳ ${socket.user.username} waiting for approval in ${code}`);
                    return; // Don't proceed — wait for host action
                }

                room.participants.push({
                    socketId: socket.id,
                    userId: socket.user.id,
                    username: socket.user.username,
                    avatar: socket.user.avatar,
                    isGuest: socket.user.isGuest || false,
                    isOnline: true,
                    isBuffering: false,
                    joinedAt: Date.now(),
                });
            }

            // Send full room state to the joining user
            socket.emit('room:state', {
                room: {
                    code: room.code,
                    name: room.name,
                    hostId: room.hostId,
                    type: room.type,
                    participantLimit: room.participantLimit,
                    currentVideo: room.currentVideo,
                    videoState: computeAdjustedVideoState(room.videoState),
                    participants: room.participants,
                    voiceParticipants: room.voiceParticipants || [],
                    requiresApproval: room.requiresApproval || false,
                },
            });

            // Notify everyone about updated participant list
            io.to(code).emit('room:participant-update', { participants: room.participants });

            // Send join system message
            const systemMsg = {
                id: `sys_${Date.now()}`,
                userId: 'system',
                username: 'System',
                avatar: null,
                content: `${socket.user.username} joined the room`,
                type: 'system',
                createdAt: new Date().toISOString(),
            };
            room.messages = room.messages || [];
            room.messages.push(systemMsg);
            io.to(code).emit('chat:message', systemMsg);

            console.log(`👥 ${socket.user.username} joined room ${code} (${room.participants.length} participants)`);
        });

        // ── room:leave ─────────────────────────────────────────────────────────
        socket.on('room:leave', () => {
            if (currentRoomCode) leaveRoom(currentRoomCode);
        });

        // ── disconnect ─────────────────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Disconnected: ${socket.user?.username} (${reason})`);
            if (currentRoomCode) leaveRoom(currentRoomCode, true);
        });

        // ────────────────────────────────────────────────────────────────────────
        /** Handles participant removal and host migration on disconnect/leave */
        const leaveRoom = (code, isDisconnect = false) => {
            const room = roomStore.get(code);
            if (!room) return;

            socket.leave(code);

            // Clean up voice connections
            if (typeof socket.cleanupVoice === 'function') {
                socket.cleanupVoice(code);
            }

            // Mark participant as offline (keep in list for short-term reconnect)
            const participant = room.participants.find((p) => p.socketId === socket.id);
            if (participant) {
                if (isDisconnect) {
                    // On disconnect, mark offline. Clean up after 30s if they don't reconnect.
                    participant.isOnline = false;
                    setTimeout(() => {
                        const stillOffline = room.participants.find(
                            (p) => p.userId === socket.user.id && !p.isOnline
                        );
                        if (stillOffline) {
                            room.participants = room.participants.filter((p) => p.userId !== socket.user.id);
                            io.to(code).emit('room:participant-update', { participants: room.participants });
                        }
                    }, 30000);
                } else {
                    room.participants = room.participants.filter((p) => p.socketId !== socket.id);
                }
            }

            // Host migration: assign new host if original host leaves permanently
            if (room.hostId === socket.user.id && !isDisconnect) {
                const nextParticipant = room.participants.find((p) => p.isOnline);
                if (nextParticipant) {
                    room.hostId = nextParticipant.userId;
                    io.to(code).emit('room:host-changed', {
                        newHostId: room.hostId,
                        newHostUsername: nextParticipant.username,
                    });
                    const msg = {
                        id: `sys_${Date.now()}`,
                        userId: 'system', username: 'System', avatar: null,
                        content: `${nextParticipant.username} is now the host`,
                        type: 'system',
                        createdAt: new Date().toISOString(),
                    };
                    room.messages.push(msg);
                    io.to(code).emit('chat:message', msg);
                }
            }

            // Broadcast leave message
            const leaveMsg = {
                id: `sys_${Date.now()}`,
                userId: 'system', username: 'System', avatar: null,
                content: `${socket.user.username} left the room`,
                type: 'system',
                createdAt: new Date().toISOString(),
            };
            room.messages.push(leaveMsg);
            io.to(code).emit('chat:message', leaveMsg);
            io.to(code).emit('room:participant-update', { participants: room.participants });

            currentRoomCode = null;
            console.log(`👋 ${socket.user.username} left room ${code}`);
        };
    });
};

/**
 * Compute the adjusted current time for a video state,
 * accounting for time elapsed since last update (while playing).
 */
function computeAdjustedVideoState(videoState) {
    if (!videoState) return null;
    if (!videoState.isPlaying) return videoState;
    const elapsedSec = (Date.now() - videoState.lastUpdated) / 1000;
    return { ...videoState, currentTime: videoState.currentTime + elapsedSec };
}
