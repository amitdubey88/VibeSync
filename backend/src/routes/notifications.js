const express = require('express');
const router = express.Router();
const authInfo = require('../middleware/auth');

router.post('/subscribe', authInfo.optionalAuth, (req, res) => {
  const subscription = req.body;
  // TODO: Implement actual Web Push saving to MongoDB here (requires user mapping)
  // Send 201 Created for mock successful subscription
  res.status(201).json({ message: 'Push subscription received.' });
});

module.exports = router;
