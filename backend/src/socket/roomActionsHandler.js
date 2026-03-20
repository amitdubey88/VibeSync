/**
 * Room Actions Socket Handler
 * Handles host-only controls: delete room, transfer host, kick, mute
 */
const { cloudinary, isConfigured } = require('../config/cloudinary');

const fs = require('fs');
const path = require('path');

const { hashRoomCode } = require('../utils/hash');

// Try to use MongoDB models gracefully
let Room, Message;
try {
    Room = require('../models/Room');
    Message = require('../models/Message');
} catch (_) { }

// In-memory blacklist for ended rooms to prevent immediate re-entry
const endedRooms = new Set();
module.exports.endedRooms = endedRooms;

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
    // Host deletes the room → cleanup files → wipe DB → notify everyone → destroy room
    socket.on('room:delete', async ({ roomCode }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can delete the room' });

        // 1. Collect all video URLs from current state + chat history for cleanup
        const urlsToCleanup = new Set();
        if (room.currentVideo?.url) urlsToCleanup.add(room.currentVideo.url);

        (room.messages || []).forEach(msg => {
            if (msg.videoUrl) urlsToCleanup.add(msg.videoUrl);
            // Search for URLs in text content if they were pasted? 
            // Actually only handles direct uploads for now.
        });

        const deleteMedia = async (url) => {
            if (!url) return;
            // Cleanup Cloudinary
            if (url.includes('res.cloudinary.com')) {
                const publicId = extractPublicId(url);
                if (publicId) {
                    return new Promise((resolve) => {
                        cloudinary.uploader.destroy(publicId, { resource_type: 'video' }, (err) => {
                            if (err) console.error(`[cloudinary] delete error (${publicId}):`, err.message);
                            else console.log(`[cloudinary] deleted media: ${publicId}`);
                            resolve();
                        });
                    });
                }
            }
            // Cleanup Local disk
            else if (url.startsWith('/uploads/')) {
                const fileName = url.replace('/uploads/', '');
                const filePath = path.join(__dirname, '..', '..', 'uploads', fileName);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`[fs] deleted local video: ${fileName}`);
                    } catch (err) {
                        console.error(`[fs] local delete error (${fileName}):`, err.message);
                    }
                }
            }
        };

        // Execute all deletions
        await Promise.allSettled([...urlsToCleanup].map(deleteMedia));

        // Notify everyone BEFORE destroying
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:deleted', {
            message: 'The host has ended the room and wiped all session data.',
            deletedBy: socket.user.username,
        });

        // Remove room from in-memory store
        roomStore.delete(code);
        
        // Add to blacklist to prevent re-entry/rehydration
        endedRooms.add(code);
        // Remove from blacklist after 1 hour (TTL) to prevent memory leak
        setTimeout(() => endedRooms.delete(code), 3600000);

        // 3. Permanent Cascading Delete in MongoDB
        if (Room && Message) {
            try {
                // Delete the room record
                await Room.deleteOne({ code: hashedCode });
                // Delete all messages associated with this room code
                await Message.deleteMany({ roomId: hashedCode });
                console.log(`[db] Wiped all data for room ${code}`);
            } catch (e) {
                console.error('[rooms/delete] DB wipe failed:', e.message);
            }
        }

        console.log(`🗑️  Room ${code} and its data permanently deleted by ${socket.user.username}`);
    });

    // ── room:toggle-lock ──────────────────────────────────────────────────────
    socket.on('room:toggle-lock', ({ roomCode, isLocked }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can lock the room' });

        room.isLocked = !!isLocked;
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:lock-changed', { isLocked: room.isLocked });

        console.log(`🔒 Room ${code} is now ${room.isLocked ? 'locked' : 'unlocked'}`);
    });

    // ── room:transfer-host ────────────────────────────────────────────────────
    socket.on('room:transfer-host', ({ roomCode, targetUserId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can transfer host' });

        // Block host transfer during active live streams
        if (room.currentVideo?.type === 'live') {
            return socket.emit('error', { message: 'Cannot transfer host while a live stream is active. Stop the stream first.' });
        }

        const target = room.participants.find((p) => p.userId === targetUserId);
        if (!target) return socket.emit('error', { message: 'Participant not found' });

        room.hostId = targetUserId;

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:host-changed', {
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
        io.to(hashedCode).emit('chat:message', msg);

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
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:participant-update', { participants: room.participants });

        const msg = {
            id: `sys_${Date.now()}`,
            userId: 'system', username: 'System', avatar: null,
            content: `${target.username} was removed from the room`,
            type: 'system',
            createdAt: new Date().toISOString(),
        };
        room.messages.push(msg);
        io.to(hashedCode).emit('chat:message', msg);

        console.log(`🚪 ${target.username} kicked from room ${code}`);
    });

    // ── room:mute ─────────────────────────────────────────────────────────────
    socket.on('room:mute', ({ roomCode, targetUserId, duration }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (!assertHost(room)) return socket.emit('error', { message: 'Only the host can mute participants' });

        const target = room.participants.find((p) => p.userId === targetUserId);
        if (!target) return socket.emit('error', { message: 'Participant not found' });

        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
            targetSocket.emit('room:muted', { mutedBy: socket.user.username, duration: duration || null });
        }

        // Sync muted status with voice participants list
        const voiceP = (room.voiceParticipants || []).find(p => p.userId === targetUserId);
        if (voiceP) {
            voiceP.isMuted = true;
            const hashedCode = hashRoomCode(code);
            io.to(hashedCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
        }

        // Feature 14: Timed auto-unmute
        const durationMs = Number(duration) * 1000;
        if (durationMs > 0 && durationMs <= 3600000) { // max 1 hour
            setTimeout(() => {
                const liveRoom = roomStore.get(code);
                if (!liveRoom) return;
                const voiceEntry = (liveRoom.voiceParticipants || []).find(p => p.userId === targetUserId);
                if (voiceEntry) voiceEntry.isMuted = false;
                const hs = hashRoomCode(code);
                // Notify the affected participant
                if (targetSocket) targetSocket.emit('room:unmuted', { message: 'Your mute has expired.' });
                io.to(hs).emit('room:voice-update', { voiceParticipants: liveRoom.voiceParticipants });
                console.log(`🔊 Timed mute expired for ${target.username} in ${code}`);
            }, durationMs);
        }

        console.log(`🔇 ${target.username} muted in room ${code} by ${socket.user.username}${durationMs > 0 ? ` for ${duration}s` : ' permanently'}`);
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
            const hashedCode = hashRoomCode(code);
            io.to(hashedCode).emit('room:voice-update', { voiceParticipants: room.voiceParticipants });
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
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:participant-update', { participants: room.participants });
        console.log(`🛡️ Screen share permission for ${target.username} set to ${canShare} by ${socket.user.username}`);
    });
};
