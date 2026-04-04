const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { hashRoomCode, generateInviteToken } = require('../utils/hash');

/**
 * Escape a string for safe use inside HTML attribute values and text nodes.
 * Prevents XSS when room names or descriptions contain HTML special characters.
 * Covers: & < > " ' ` = / (OWASP recommended set)
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/`/g, '&#x60;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Escape a string for safe insertion inside a JavaScript string literal.
 * Used for the fallback setTimeout redirect inside the <script> block.
 */
function escapeJs(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/</g, '\\u003C')
        .replace(/>/g, '\\u003E')
        .replace(/&/g, '\\u0026');
}

// GET /invite/:roomCode - Renders a simple HTML page with Open Graph tags
router.get('/:roomCode', async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const t = generateInviteToken(code);
  // roomStore is attached to app.locals in server.js — access it via req.app.locals
  const roomStore = req.app.locals.roomStore;
  
  let room = roomStore ? roomStore.get(code) : null;
  let participantCount = room ? (room.participants || []).length : 0;

  // Fallback to DB if not in-memory (e.g. server restart)
  if (!room) {
    try {
      const hashedCode = hashRoomCode(code);
      room = await Room.findOne({ code: hashedCode, isActive: true }).lean();
    } catch (err) {
      console.warn('[invite] DB lookup failed:', err.message);
    }
  }

  const roomName = room ? room.name : 'VibeSync Watch Party';
  const description = room
    ? `Join ${roomName} and watch videos in perfect sync with live chat and voice!${participantCount > 0 ? ` (${participantCount} watching now)` : ''}`
    : 'Join my VibeSync room to watch together in real-time.';

  // Determine Thumbnail
  let imageUrl = '/og-preview.png'; // Default preview image
  if (room?.currentVideo?.type === 'youtube' && room.currentVideo.url) {
    // Only use YouTube video IDs (alphanumeric, dashes, underscores — max 20 chars)
    const videoId = String(room.currentVideo.url).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
    if (videoId) {
      imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }

  // Ensure absolute image URL if it's local
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  if (imageUrl.startsWith('/')) {
    imageUrl = `${protocol}://${host}${imageUrl}`;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://vibesync.live';
  const joinUrl = `${frontendUrl}/room/${code}?t=${t}`;

  // ── Escape all user-controlled data before HTML interpolation ───────────────
  const safeRoomName = escapeHtml(roomName);
  const safeDescription = escapeHtml(description);
  const safeImageUrl = escapeHtml(imageUrl);
  const safeJoinUrl = escapeHtml(joinUrl);
  const safeJoinUrlJs = escapeJs(joinUrl); // for <script> block
  const safeCode = escapeHtml(code);
  const safeProtocol = escapeHtml(protocol);
  const safeHost = escapeHtml(host);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${safeRoomName}</title>
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="Join: ${safeRoomName}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:image" content="${safeImageUrl}">
    <meta property="og:url" content="${safeProtocol}://${safeHost}/invite/${safeCode}">
    <meta property="og:type" content="website">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Join: ${safeRoomName}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${safeImageUrl}">

    <!-- Security headers via meta (belt-and-suspenders) -->
    <meta http-equiv="X-Content-Type-Options" content="nosniff">

    <!-- Auto Redirect to Frontend -->
    <meta http-equiv="refresh" content="0; url=${safeJoinUrl}">
</head>
<body style="background-color: #0a0a0f; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; text-align: center;">
    <div style="background: rgba(255,255,255,0.05); padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); max-width: 400px; width: 90%;">
        <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Welcome to ${safeRoomName}</h1>
        <p style="margin: 0 0 32px; color: #a1a1aa; font-size: 16px; line-height: 1.5;">Redirecting you to the watch party sync...</p>
        <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #e50914; border-radius: 50%; display: inline-block; animation: spin 1s linear infinite;"></div>
    </div>
    
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>

    <script>
      // Fallback redirect if meta refresh fails
      setTimeout(function() {
        window.location.href = '${safeJoinUrlJs}';
      }, 800);
    </script>
</body>
</html>
  `;

  // Set security headers on the response
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy',
    "default-src 'none'; " +
    "style-src 'unsafe-inline'; " +
    "script-src 'unsafe-inline'; " +
    "img-src https://img.youtube.com https://res.cloudinary.com 'self'; " +
    "frame-ancestors 'none';"
  );
  res.send(html);
});

module.exports = router;
