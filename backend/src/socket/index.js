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
const videoStreamHandler = require('./videoStreamHandler');
const { hashRoomCode } = require('../utils/hash');

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
        videoStreamHandler(io, socket, roomStore);

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
            const hashedCode = hashRoomCode(code);
            io.to(hashedCode).emit('room:approval-changed', { requiresApproval: room.requiresApproval });
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
                status: 'online',
                isBuffering: false,
                joinedAt: Date.now(),
            });

            // Sent to the user who was approved
            io.to(pending.socketId).emit('room:state', {
                room: {
                    code: room.code, name: room.name, hostId: room.hostId,
                    type: room.type, participantLimit: room.participantLimit,
                    currentVideo: room.currentVideo,
                    videoState: computeAdjustedVideoState(room.videoState),
                    participants: room.participants,
                    voiceParticipants: room.voiceParticipants || [],
                    requiresApproval: room.requiresApproval || false,
                    isLocked: room.isLocked || false,
                },
            });

            const hashedCode = hashRoomCode(code);
            // Broadcast updated participant list
            io.to(hashedCode).emit('room:participant-update', { participants: room.participants });

            const msg = {
                id: `sys_${Date.now()}`, userId: 'system', username: 'System',
                avatar: null, content: `${pending.username} joined the room`, type: 'system',
                createdAt: new Date().toISOString()
            };
            room.messages = room.messages || [];
            room.messages.push(msg);
            io.to(hashedCode).emit('chat:message', msg);

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

            if (room.isLocked && socket.user.id !== room.hostId) {
                return socket.emit('room:join-error', { message: 'This room is currently locked by the host.' });
            }

            // Leave previous room if any
            if (currentRoomCode && currentRoomCode !== code) {
                leaveRoom(currentRoomCode);
            }

            currentRoomCode = code;
            const hashedCode = hashRoomCode(code);
            socket.join(hashedCode);

            // Add participant if not already present
            const existing = room.participants.find((p) => p.userId === socket.user.id);
            if (existing) {
                existing.socketId = socket.id; // Update socket ID on reconnect
                existing.isOnline = true;

                // Cancel the pending disconnect/cleanup timer for this user (BUG-3)
                if (room._disconnectTimers?.[socket.user.id]) {
                    clearTimeout(room._disconnectTimers[socket.user.id]);
                    delete room._disconnectTimers[socket.user.id];
                }

                // If the reconnecting user is the host, clear hostAway and notify room (BUG-13)
                if (room.hostId === socket.user.id && room.hostAway) {
                    room.hostAway = false;
                    io.to(hashedCode).emit('room:host-back', {
                        message: 'Host has reconnected.'
                    });
                }
            } else {
                // ── Username conflict check ───────────────────────────────────────
                const nameTaken = room.participants.find(
                    (p) => p.username.toLowerCase() === socket.user.username.toLowerCase() && p.isOnline !== false
                );
                if (nameTaken) {
                    socket.leave(hashedCode);
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
                    status: 'online',
                    isBuffering: false,
                    joinedAt: Date.now(),
                    canShareScreen: isRoomHost, // host gets default access
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
                    isLocked: room.isLocked || false,
                },
            });

            // Notify everyone about updated participant list
            io.to(hashedCode).emit('room:participant-update', { participants: room.participants });
            
            // Send join system message ONLY for new participants (BUGFIX: avoid dupe on reconnect)
            if (!existing) {
                const systemMsg = {
                    id: `sysJoin_${socket.user.id}_${Date.now()}`,
                    userId: 'system',
                    username: 'System',
                    avatar: null,
                    content: `${socket.user.username} joined the room`,
                    type: 'system',
                    createdAt: new Date().toISOString(),
                };
                room.messages = room.messages || [];
                room.messages.push(systemMsg);
                io.to(hashedCode).emit('chat:message', systemMsg);
                console.log(`👥 ${socket.user.username} joined room ${code} (${room.participants.length} participants)`);
            } else {
                console.log(`🔄 ${socket.user.username} reconnected to room ${code}`);
            }
        });

        // ── room:set-status ───────────────────────────────────────────────────
        socket.on('room:set-status', ({ roomCode, status }) => {
            const code = roomCode?.toUpperCase();
            const room = roomStore.get(code);
            if (!room) return;

            const participant = room.participants.find((p) => p.userId === socket.user.id);
            if (participant) {
                participant.status = status; // e.g., 'online', 'away'
                const hashedCode = hashRoomCode(code);
                io.to(hashedCode).emit('room:participant-update', { participants: room.participants });
            }
        });

        // ── room:leave ─────────────────────────────────────────────────────────
        socket.on('room:leave', ({ explicit = false } = {}) => {
            if (currentRoomCode) {
                // If explicit=false, treat it as a temporary disconnect (wait 30s)
                leaveRoom(currentRoomCode, !explicit);
            }
        });

        // ── disconnect ─────────────────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Disconnected: ${socket.user?.username} (${reason})`);
            if (currentRoomCode) leaveRoom(currentRoomCode, true);
        });

        // ────────────────────────────────────────────────────────────────────────
        /**
         * Handles participant removal and host-away notification on disconnect/leave.
         * 
         * KEY DESIGN DECISIONS (BUG-3, BUG-4, BUG-13):
         * - 30s timer re-reads room from roomStore (fixing stale closure ref)
         * - Timer is stored per-userId so reconnect can cancel it
         * - No automatic host transfer — participants see a "host away" banner instead
         * - Leave chat message only broadcasts for explicit permanent leaves
         */
        const leaveRoom = (code, isDisconnect = false) => {
            const room = roomStore.get(code);
            if (!room) return;

            const hashedCode = hashRoomCode(code);
            socket.leave(hashedCode);

            // Clean up voice connections
            if (typeof socket.cleanupVoice === 'function') {
                socket.cleanupVoice(code);
            }

            const participant = room.participants.find((p) => p.socketId === socket.id);

            if (isDisconnect) {
                // ── Temporary disconnect: mark offline, wait 30s for reconnect ──────
                if (participant) {
                    participant.isOnline = false;
                }

                // If host disconnected, broadcast "host away" banner to participants
                const isHostDisconnect = room.hostId === socket.user.id;
                if (isHostDisconnect) {
                    room.hostAway = true;
                    io.to(hashedCode).emit('room:host-away', {
                        message: 'Host has temporarily disconnected. Waiting for them to return…'
                    });
                }

                // Broadcast updated participant list (show user as offline)
                io.to(hashedCode).emit('room:participant-update', { participants: room.participants });

                // Track timer so reconnect can cancel it (BUG-3: use roomStore lookup, not closure)
                if (!room._disconnectTimers) room._disconnectTimers = {};
                if (room._disconnectTimers[socket.user.id]) {
                    clearTimeout(room._disconnectTimers[socket.user.id]);
                }

                room._disconnectTimers[socket.user.id] = setTimeout(() => {
                    // Re-read room from store — original reference may be stale (BUG-3)
                    const liveRoom = roomStore.get(code);
                    if (!liveRoom) return;

                    const stillOffline = liveRoom.participants.find(
                        (p) => p.userId === socket.user.id && !p.isOnline
                    );

                    if (stillOffline) {
                        // Remove participant permanently
                        liveRoom.participants = liveRoom.participants.filter(
                            (p) => p.userId !== socket.user.id
                        );
                        delete liveRoom._disconnectTimers?.[socket.user.id];

                        // BUG-13: No automatic host promotion.
                        // If host never came back, clear the "host away" flag and
                        // keep the room in a "no host" state. Remaining participants
                        // can use the Transfer Host option to pick a new host manually.
                        if (liveRoom.hostId === socket.user.id) {
                            liveRoom.hostAway = false;
                            io.to(hashedCode).emit('room:host-left', {
                                message: 'The host has left the room. Use the Participants menu to transfer host.'
                            });
                        }

                        // Now send the leave message (deferred so it only shows for actual permanent leaves)
                        const leaveMsg = {
                            id: `sys_${Date.now()}`,
                            userId: 'system', username: 'System', avatar: null,
                            content: `${socket.user.username} left the room`,
                            type: 'system',
                            createdAt: new Date().toISOString(),
                        };
                        liveRoom.messages = liveRoom.messages || [];
                        liveRoom.messages.push(leaveMsg);
                        io.to(hashedCode).emit('chat:message', leaveMsg);
                        io.to(hashedCode).emit('room:participant-update', { participants: liveRoom.participants });
                    }
                }, 30000);

            } else {
                // ── Explicit leave: remove immediately ──────────────────────────────
                if (participant) {
                    room.participants = room.participants.filter((p) => p.socketId !== socket.id);
                }

                // Cancel any pending reconnect timer
                if (room._disconnectTimers?.[socket.user.id]) {
                    clearTimeout(room._disconnectTimers[socket.user.id]);
                    delete room._disconnectTimers[socket.user.id];
                }

                // If host leaves explicitly, notify but DO NOT auto-transfer (BUG-13)
                if (room.hostId === socket.user.id) {
                    room.hostAway = false;
                    io.to(hashedCode).emit('room:host-left', {
                        message: 'The host has left the room. Use the Participants menu to transfer host.'
                    });
                }

                // Broadcast leave message for explicit leaves only (BUG-4)
                const leaveMsg = {
                    id: `sys_${Date.now()}`,
                    userId: 'system', username: 'System', avatar: null,
                    content: `${socket.user.username} left the room`,
                    type: 'system',
                    createdAt: new Date().toISOString(),
                };
                room.messages = room.messages || [];
                room.messages.push(leaveMsg);
                io.to(hashedCode).emit('chat:message', leaveMsg);
                io.to(hashedCode).emit('room:participant-update', { participants: room.participants });
            }

            currentRoomCode = null;
            console.log(`👋 ${socket.user.username} ${isDisconnect ? 'disconnected from' : 'left'} room ${code}`);
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
