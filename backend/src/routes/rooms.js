const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { ROOM_TYPE } = require('../config/constants');
const { hashRoomCode } = require('../utils/hash');
const { endedRooms } = require('../socket/roomActionsHandler');

// Try to use MongoDB models; fall back gracefully
let Room, Message;
try {
    Room = require('../models/Room');
    Message = require('../models/Message');
} catch (_) { }

const isDbReady = () => mongoose.connection.readyState === 1;

/**
 * Generate a random 6-character room code (alphanumeric, uppercase)
 */
const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
};

// In-memory room store reference (shared with socket handlers via app.locals)
const getRoomStore = (req) => req.app.locals.roomStore;

/**
 * Rehydrate a room into the in-memory store from MongoDB.
 * Called when a room code is valid in DB but the in-memory store was cleared
 * (e.g. after a server restart on Render/Koyeb free tier).
 */
async function hydrateRoom(req, code) {
    const store = getRoomStore(req);
    if (store.has(code)) return store.get(code);

    // Block rehydration if the room was recently ended
    if (endedRooms.has(code)) {
        console.log(`[rooms/hydrate] Blocked rehydration for ended room: ${code}`);
        return null;
    }

    if (!Room || !isDbReady()) return null;
    try {
        const hashedCode = hashRoomCode(code);
        const dbRoom = await Room.findOne({ code: hashedCode, isActive: true }).lean();
        if (!dbRoom) return null;
        const roomData = {
            code: code,  // Use the plain room code (not the hash stored in DB)
            name: dbRoom.name,
            hostId: dbRoom.hostId,
            type: dbRoom.type,
            participantLimit: dbRoom.participantLimit || 20,
            password: dbRoom.password || null,
            currentVideo: dbRoom.currentVideo || null,
            videoState: dbRoom.videoState || { currentTime: 0, isPlaying: false, lastUpdated: Date.now() },
            participants: [],
            messages: [],
            voiceParticipants: [],
            pendingJoins: [],
            requiresApproval: false,
        };
        store.set(code, roomData);
        console.log(`[rooms] Rehydrated room ${code} from MongoDB after server restart`);
        return roomData;
    } catch (err) {
        console.warn('[rooms/hydrate]', err.message);
        return null;
    }
}

// ─── POST /api/rooms ──────────────────────────────────────────────────────────
// Creates a new room. Host must be authenticated.
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, type = ROOM_TYPE.PUBLIC, participantLimit = 20, password } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: 'Room name required' });

        let code;
        let attempts = 0;
        // Ensure unique code
        do {
            code = generateRoomCode();
            attempts++;
        } while (getRoomStore(req).has(code) && attempts < 10);

        const roomData = {
            code,
            name: name.trim().slice(0, 60),
            hostId: req.user.id,
            type,
            participantLimit: Math.min(Math.max(parseInt(participantLimit) || 20, 2), 50),
            password: type === ROOM_TYPE.PRIVATE ? password : null,
            currentVideo: null,
            videoState: { currentTime: 0, isPlaying: false, lastUpdated: Date.now() },
            participants: [],
            messages: [],
            voiceParticipants: [],
            pendingJoins: [],
            requiresApproval: false,
        };

        // Store in-memory (the live source of truth)
        getRoomStore(req).set(code, roomData);

        // Persist to MongoDB if available and connected
        if (Room && isDbReady()) {
            const hashedCode = hashRoomCode(code);
            const hashedPassword = roomData.password ? await bcrypt.hash(roomData.password, 10) : null;

            Room.create({
                code: hashedCode,
                name: roomData.name,
                hostId: roomData.hostId,
                type,
                participantLimit: roomData.participantLimit,
                password: hashedPassword,
            }).catch((e) => console.warn('[rooms/create] DB persist failed:', e.message));
        }

        return res.status(201).json({ success: true, room: { code, name: roomData.name, type, hostId: roomData.hostId } });
    } catch (err) {
        console.error('[rooms/create]', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET /api/rooms/:code ─────────────────────────────────────────────────────
// Returns room metadata. No auth required (used for previewing room before join).
router.get('/:code', async (req, res) => {
    const { code } = req.params;
    // Try in-memory first; fall back to MongoDB (handles server restarts)
    const room = await hydrateRoom(req, code.toUpperCase());

    if (!room) {
        return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Strip sensitive data
    const { password, messages, ...safeRoom } = room;
    return res.json({
        success: true,
        room: {
            ...safeRoom,
            isPasswordProtected: !!password,
            participantCount: room.participants.length,
        },
    });
});

// ─── POST /api/rooms/:code/join ───────────────────────────────────────────────
// Validates credentials before allowing socket join. Returns room's video state
// for initial sync.
router.post('/:code/join', authenticate, async (req, res) => {
    const { code } = req.params;
    const { password } = req.body;
    // Try in-memory first; fall back to MongoDB (handles server restarts)
    const room = await hydrateRoom(req, code.toUpperCase());

    if (!room) {
        // Specifically check if it was ended recently to provide a better error
        if (endedRooms.has(code.toUpperCase())) {
            return res.status(403).json({ success: false, message: 'This session has ended.' });
        }
        return res.status(404).json({ success: false, message: 'Room not found' });
    }
    // Count only online participants toward the limit
    const onlineCount = room.participants.filter(p => p.isOnline !== false).length;
    if (onlineCount >= room.participantLimit) {
        return res.status(403).json({ success: false, message: 'Room is full' });
    }

    // In-memory room might have plain password or hashed if rehydrated
    // But hydrateRoom ensures we get a consistent object.
    // If room has a password, we need to verify it.
    if (room.password) {
        // If the stored password doesn't match the input, try bcrypt comparison 
        // (handles cases where password in memory is the hash from DB)
        if (room.password !== password) {
            const isMatch = await bcrypt.compare(password, room.password).catch(() => false);
            if (!isMatch) {
                return res.status(403).json({ success: false, message: 'Incorrect password' });
            }
        }
    }

    return res.json({
        success: true,
        room: {
            code: room.code,
            name: room.name,
            type: room.type,
            hostId: room.hostId,
            currentVideo: room.currentVideo,
            videoState: room.videoState,
            participantLimit: room.participantLimit,
        },
    });
});

// ─── GET /api/rooms/:code/messages ────────────────────────────────────────────
// Fetch last 100 messages for a room (chat history on join).
router.get('/:code/messages', authenticate, async (req, res) => {
    const { code } = req.params;
    const room = await hydrateRoom(req, code.toUpperCase());
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    try {
        if (Message && isDbReady()) {
            const hashedCode = hashRoomCode(code);
            const messages = await Message.find({ roomId: hashedCode })
                .sort({ createdAt: -1 }).limit(100).lean();
            return res.json({ success: true, messages: messages.reverse() });
        }
        // Fall back to in-memory messages (last 100)
        const messages = (room.messages || []).slice(-100);
        return res.json({ success: true, messages });
    } catch (err) {
        console.error('[rooms/messages]', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
