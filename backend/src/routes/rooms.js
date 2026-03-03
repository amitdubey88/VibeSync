const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { ROOM_TYPE } = require('../config/constants');

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
        };

        // Store in-memory (the live source of truth)
        getRoomStore(req).set(code, roomData);

        // Persist to MongoDB if available and connected
        if (Room && isDbReady()) {
            Room.create({
                code, name: roomData.name, hostId: roomData.hostId,
                type, participantLimit: roomData.participantLimit, password: roomData.password,
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
router.get('/:code', (req, res) => {
    const { code } = req.params;
    const room = getRoomStore(req).get(code.toUpperCase());

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
router.post('/:code/join', authenticate, (req, res) => {
    const { code } = req.params;
    const { password } = req.body;
    const room = getRoomStore(req).get(code.toUpperCase());

    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.participants.length >= room.participantLimit) {
        return res.status(403).json({ success: false, message: 'Room is full' });
    }
    if (room.password && room.password !== password) {
        return res.status(403).json({ success: false, message: 'Incorrect password' });
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
    const room = getRoomStore(req).get(code.toUpperCase());
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    try {
        if (Message && isDbReady()) {
            const messages = await Message.find({ roomId: code.toUpperCase() })
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
