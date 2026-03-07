/**
 * Room Actions Socket Handler
 * Handles host-only controls: delete room, transfer host, kick, mute
 */
const { cloudinary, isConfigured } = require('../config/cloudinary');

// Try to use MongoDB models gracefully
let Room;
try {
    Room = require('../models/Room');
} catch (_) { }

/**
 * Extract Cloudinary public_id from a secure_url
 * e.g. https://res.cloudinary.com/mycloud/video/upload/v123/vibesync/abc.mp4
 *      → vibesync/abc
 */
const extractPublicId = (url) => {
    try {
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
        return match ? match[1] : null;
    } catch { return null; }
};

module.exports = (io, socket, roomStore) => {
    const assertHost = (room) => room && room.hostId === socket.user.id;

    // ── room:delete ────────────────────────────────────────────────────────────
    // Host deletes the room → cleanup Cloudinary file → notify everyone → destroy room
    socket.on('room:delete', ({ roomCode }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can delete the room' });

        // Delete Cloudinary video if the current video was uploaded there
        const videoUrl = room.currentVideo?.url;
        if (videoUrl && isConfigured() && videoUrl.includes('res.cloudinary.com')) {
            const publicId = extractPublicId(videoUrl);
            if (publicId) {
                cloudinary.uploader.destroy(publicId, { resource_type: 'video' }, (err) => {
                    if (err) console.error('[cloudinary] delete error:', err.message);
                    else console.log(`[cloudinary] deleted video: ${publicId}`);
                });
            }
        }

        // Notify everyone before destroying
        io.to(code).emit('room:deleted', {
            message: 'The host has ended the room.',
            deletedBy: socket.user.username,
        });

        // Remove room from store
        roomStore.delete(code);

        // Deactivate in DB to prevent re-hydrating later
        if (Room) {
            Room.updateOne({ code }, { $set: { isActive: false } })
                .catch(e => console.warn('[rooms/delete] DB deactivate failed:', e.message));
        }

        console.log(`🗑️  Room ${code} deleted by ${socket.user.username}`);
    });

    // ── room:toggle-lock ──────────────────────────────────────────────────────
    socket.on('room:toggle-lock', ({ roomCode, isLocked }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can lock the room' });

        room.isLocked = !!isLocked;
        io.to(code).emit('room:lock-changed', { isLocked: room.isLocked });

        console.log(`🔒 Room ${code} is now ${room.isLocked ? 'locked' : 'unlocked'}`);
    });

    // ── room:transfer-host ────────────────────────────────────────────────────
    socket.on('room:transfer-host', ({ roomCode, targetUserId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can transfer host' });

        const target = room.participants.find((p) => p.userId === targetUserId);
        if (!target) return socket.emit('error', { message: 'Participant not found' });

        room.hostId = targetUserId;

        io.to(code).emit('room:host-changed', {
            newHostId: targetUserId,
            newHostUsername: target.username,
        });

        const msg = {
            id: `sys_${Date.now()}`,
            userId: 'system', username: 'System', avatar: null,
            content: `👑 ${target.username} is now the host`,
            type: 'system',
            createdAt: new Date().toISOString(),
        };
        room.messages = room.messages || [];
        room.messages.push(msg);
        io.to(code).emit('chat:message', msg);

        console.log(`👑 Host transferred to ${target.username} in room ${code}`);
    });

    // ── room:kick ─────────────────────────────────────────────────────────────
    socket.on('room:kick', ({ roomCode, targetUserId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can remove participants' });
        if (targetUserId === socket.user.id) return socket.emit('error', { message: 'Cannot kick yourself' });

        const target = room.participants.find((p) => p.userId === targetUserId);
        if (!target) return socket.emit('error', { message: 'Participant not found' });

        // Emit kick event to the target socket
        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
            targetSocket.emit('room:kicked', { message: 'You have been removed from the room by the host.' });
            targetSocket.leave(code);
        }

        // Remove from participants list
        room.participants = room.participants.filter((p) => p.userId !== targetUserId);
        io.to(code).emit('room:participant-update', { participants: room.participants });

        const msg = {
            id: `sys_${Date.now()}`,
            userId: 'system', username: 'System', avatar: null,
            content: `${target.username} was removed from the room`,
            type: 'system',
            createdAt: new Date().toISOString(),
        };
        room.messages.push(msg);
        io.to(code).emit('chat:message', msg);

        console.log(`🚪 ${target.username} kicked from room ${code}`);
    });

    // ── room:mute ─────────────────────────────────────────────────────────────
    socket.on('room:mute', ({ roomCode, targetUserId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can mute participants' });

        const target = room.participants.find((p) => p.userId === targetUserId);
        if (!target) return socket.emit('error', { message: 'Participant not found' });

        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
            targetSocket.emit('room:muted', { mutedBy: socket.user.username });
        }

        // Sync muted status with voice participants list
        const voiceP = (room.voiceParticipants || []).find(p => p.userId === targetUserId);
        if (voiceP) {
            voiceP.isMuted = true;
            io.to(code).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
        }

        console.log(`🔇 ${target.username} muted in room ${code} by ${socket.user.username}`);
    });

    // ── room:mute-all ─────────────────────────────────────────────────────────
    socket.on('room:mute-all', ({ roomCode }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can mute participants' });

        let updatedVoice = false;
        room.participants.forEach((p) => {
            if (p.userId !== socket.user.id) {
                const targetSocket = io.sockets.sockets.get(p.socketId);
                if (targetSocket) {
                    targetSocket.emit('room:muted', { mutedBy: socket.user.username });
                }

                // Sync with voice list
                const voiceP = (room.voiceParticipants || []).find(vp => vp.userId === p.userId);
                if (voiceP && !voiceP.isMuted) {
                    voiceP.isMuted = true;
                    updatedVoice = true;
                }
            }
        });

        if (updatedVoice) {
            io.to(code).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
        }

        console.log(`🔇 All participants muted in room ${code} by ${socket.user.username}`);
    });

    // ── room:toggle-screen-share-permission ──────────────────────────────────
    socket.on('room:toggle-screen-share-permission', ({ roomCode, targetUserId, canShare }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can change permissions' });

        const target = room.participants.find((p) => p.userId === targetUserId);
        if (!target) return socket.emit('error', { message: 'Participant not found' });

        target.canShareScreen = !!canShare;

        // Broadcast the updated participant list to everyone so the UI updates
        io.to(code).emit('room:participant-update', { participants: room.participants });
        console.log(`🛡️ Screen share permission for ${target.username} set to ${canShare} by ${socket.user.username}`);
    });
};
