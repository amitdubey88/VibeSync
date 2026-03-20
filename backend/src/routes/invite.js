const express = require('express');
const router = express.Router();

// GET /invite/:roomCode - Renders a simple HTML page with Open Graph tags
router.get('/:roomCode', (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  // roomStore is attached to app.locals in server.js — access it via req.app.locals
  const roomStore = req.app.locals.roomStore;
  const room = roomStore ? roomStore.get(code) : null;

  const roomName = room ? room.name : 'VibeSync Watch Party';
  const description = room
    ? `Join ${roomName} and watch videos in perfect sync with live chat and voice!`
    : 'Join my VibeSync room to watch together in real-time.';
  const joinUrl = `/room/${code}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${roomName}</title>
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="Join: ${roomName}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="/favicon-192.png">
    <meta property="og:url" content="${req.protocol}://${req.get('host')}/invite/${code}">
    <meta property="og:type" content="website">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Join: ${roomName}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="/favicon-192.png">

    <!-- Auto Redirect -->
    <meta http-equiv="refresh" content="0; url=${joinUrl}">
</head>
<body style="background-color: #0a0a0f; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
    <p>Redirecting you to the room...</p>
    <script>
      window.location.href = "${joinUrl}";
    </script>
</body>
</html>
  `;

  res.send(html);
});

module.exports = router;
