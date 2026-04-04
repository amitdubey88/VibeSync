/**
 * VibeSync Extension API Routes
 * Provides sync state and chat for browser extension (no JWT required — just room code)
 * 
 * POST /api/ext/sync/:roomCode    — push playback state
 * GET  /api/ext/sync/:roomCode    — get current state + participants + chat
 * POST /api/ext/chat/:roomCode    — send a chat message
 */

const express = require('express');
const router = express.Router();

// In-memory store: roomCode → { state, participants, messages }
const extRooms = new Map();

const TTL_MS = 60 * 60 * 1000; // 1 hour

function getRoom(roomCode) {
  if (!extRooms.has(roomCode)) {
    extRooms.set(roomCode, {
      state: null,
      participants: [],      // array of usernames
      messages: [],
      updatedAt: Date.now(),
    });
  }
  return extRooms.get(roomCode);
}

// Cleanup stale rooms every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of extRooms.entries()) {
    if (now - room.updatedAt > TTL_MS) extRooms.delete(code);
  }
}, 30 * 60 * 1000);

// ── POST /api/ext/sync/:roomCode — push state ────────────────────────────────
router.post('/sync/:roomCode', (req, res) => {
  const rawCode = (req.params.roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!rawCode || rawCode.length < 4) return res.status(400).json({ error: 'invalid room code' });

  const { action, currentTime, isPlaying, pageUrl, platform } = req.body;
  // Sanitize username: strip HTML chars, clamp length
  const username = typeof req.body.username === 'string'
    ? req.body.username.replace(/[<>"'`;&]/g, '').trim().slice(0, 30)
    : null;

  if (!username) return res.status(400).json({ error: 'username required' });

  const room = getRoom(rawCode);
  room.updatedAt = Date.now();

  // Update participant heartbeat
  if (!room.participants.includes(username)) {
    room.participants.push(username);
  }

  // Only update state for meaningful actions (not background timeupdate heartbeats)
  if (action !== 'timeupdate' || !room.state) {
    room.state = {
      action,
      currentTime: parseFloat(currentTime) || 0,
      isPlaying: Boolean(isPlaying),
      // Only store the hostname, not the full pageUrl (which could be long/sensitive)
      pageUrl: pageUrl ? (() => { try { return new URL(pageUrl).hostname; } catch { return null; } })() : null,
      platform: typeof platform === 'string' ? platform.slice(0, 50) : null,
      pushedBy: username,
      updatedAt: Date.now(),
    };
  } else {
    // For timeupdate, just keep currentTime fresh if close enough
    if (isPlaying && room.state.pushedBy === username) {
      room.state.currentTime = parseFloat(currentTime) || 0;
      room.state.updatedAt = Date.now();
    }
  }

  res.json({ ok: true });
});

// ── GET /api/ext/sync/:roomCode — get current state ─────────────────────────
router.get('/sync/:roomCode', (req, res) => {
  const rawCode = (req.params.roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!rawCode || rawCode.length < 4) return res.status(400).json({ error: 'invalid room code' });

  const username = typeof req.query.username === 'string'
    ? req.query.username.replace(/[<>"'`;&]/g, '').trim().slice(0, 30)
    : null;

  const room = getRoom(rawCode);

  // Heartbeat: register this participant as online
  if (username && !room.participants.includes(username)) {
    room.participants.push(username);
  }

  // Only return messages from last 5 min
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;

  // ── BRIDGE: Pull messages from main Socket room too ──
  const mainStore = req.app.locals.roomStore;
  let allMessages = [...room.messages];

  if (mainStore && mainStore.has(rawCode)) {
    const mainRoom = mainStore.get(rawCode);
    if (mainRoom.messages) {
      allMessages = [...allMessages, ...mainRoom.messages];
    }
  }

  // Deduplicate by ID and sort by time, then filter recent
  const uniqueUrls = new Map();
  allMessages.forEach(m => uniqueUrls.set(m.id, m));

  const recentMessages = Array.from(uniqueUrls.values())
    .map(m => ({
      id: m.id,
      username: m.username,
      message: m.content || m.message,
      timestamp: m.timestamp || new Date(m.createdAt).getTime()
    }))
    .filter(m => m.timestamp > fiveMinAgo)
    .sort((a, b) => a.timestamp - b.timestamp);

  res.json({
    state:        room.state,
    participants: room.participants,
    messages:     recentMessages,
  });
});

// ── POST /api/ext/chat/:roomCode — send chat ─────────────────────────────────
router.post('/chat/:roomCode', (req, res) => {
  const rawCode = (req.params.roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!rawCode || rawCode.length < 4) return res.status(400).json({ error: 'invalid room code' });

  const rawMessage = typeof req.body.message === 'string' ? req.body.message : '';
  const rawUsername = typeof req.body.username === 'string' ? req.body.username : '';
  const message = rawMessage.trim().slice(0, 500);
  const username = rawUsername.replace(/[<>"'`;&]/g, '').trim().slice(0, 30);

  if (!message || !username) return res.status(400).json({ error: 'message and username required' });
  if (rawMessage.length > 500) return res.status(400).json({ error: 'message too long' });

  const roomCode = rawCode;
  const room = getRoom(roomCode);
  const msgObj = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    username: username.slice(0, 30),
    message: message.slice(0, 500),
    timestamp: Date.now(),
  };

  room.messages.push(msgObj);
  if (room.messages.length > 100) room.messages = room.messages.slice(-100);

  // ── BRIDGE TO MAIN SOCKET ROOM ──
  const io = req.app.locals.io;
  const mainStore = req.app.locals.roomStore;

  if (io && mainStore && mainStore.has(roomCode)) {
    const mainRoom = mainStore.get(roomCode);
    const socketMsg = {
      id: msgObj.id,
      roomId: roomCode,
      userId: `ext_${username}`,
      username: username,
      avatar: null,
      content: msgObj.message,
      type: 'text',
      createdAt: new Date().toISOString()
    };

    // Add to main room history
    mainRoom.messages = mainRoom.messages || [];
    mainRoom.messages.push(socketMsg);
    if (mainRoom.messages.length > 500) mainRoom.messages.shift();

    // Broadcast to the web clients
    io.to(roomCode).emit('chat:message', socketMsg);
  }

  res.json({ ok: true });
});

module.exports = router;
