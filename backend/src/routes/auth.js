const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const router = express.Router();

// Try to use MongoDB User model; fall back gracefully
let User;
try {
    User = require('../models/User');
} catch {
    // Graceful fallback if mapping model fails
}

/** Returns true only if MongoDB connection is ready. */
const isDbReady = () => mongoose.connection.readyState === 1;

/** Generate a JWT for a user payload */
const signToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

/** Pick an avatar color based on username */
const pickAvatarColor = (username) => {
    const colors = [
        '#e50914', '#8b5cf6', '#06b6d4', '#10b981',
        '#f59e0b', '#ef4444', '#3b82f6', '#ec4899',
    ];
    return colors[username.charCodeAt(0) % colors.length];
};

// ─── POST /api/auth/guest ─────────────────────────────────────────────────────
router.post('/guest', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username || username.trim().length < 2) {
            return res.status(400).json({ success: false, message: 'Username must be at least 2 characters' });
        }

        const sanitized = username.trim().slice(0, 30);
        const avatar = pickAvatarColor(sanitized);
        let userId;

        // Only write to MongoDB if the connection is actually ready
        if (User && isDbReady()) {
            try {
                const guest = await User.create({ username: sanitized, avatar, isGuest: true });
                userId = guest._id.toString();
            } catch (dbErr) {
                console.warn('[auth/guest] DB write failed, using in-memory ID:', dbErr.message);
                userId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            }
        } else {
            userId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        }

        const payload = { id: userId, username: sanitized, avatar, isGuest: true };
        const token = signToken(payload);
        return res.json({ success: true, token, user: payload });
    } catch (err) {
        console.error('[auth/guest]', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/auth/otp/send ─────────────────────────────────────────────────
router.post('/otp/send', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email required' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        if (User && isDbReady()) {
            await User.findOneAndUpdate(
                { email: email.toLowerCase() },
                { otp, otpExpiry: expiry },
                { upsert: true }
            );
        }

        console.log(`📧 OTP for ${email}: ${otp}`);
        return res.json({ success: true, message: 'OTP sent (check server console in dev mode)' });
    } catch (err) {
        console.error('[auth/otp/send]', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/auth/otp/verify ────────────────────────────────────────────────
router.post('/otp/verify', async (req, res) => {
    try {
        const { email, otp, username } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

        if (!User || !isDbReady()) {
            return res.status(503).json({ success: false, message: 'Database unavailable' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ success: false, message: 'Email not found' });
        if (user.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
        if (user.otpExpiry < new Date()) return res.status(400).json({ success: false, message: 'OTP expired' });

        user.otp = undefined;
        user.otpExpiry = undefined;
        user.isGuest = false;
        if (username) user.username = username.trim().slice(0, 30);
        await user.save();

        const payload = {
            id: user._id.toString(),
            username: user.username,
            avatar: user.avatar,
            isGuest: false,
            email: user.email,
        };
        const token = signToken(payload);
        return res.json({ success: true, token, user: payload });
    } catch (err) {
        console.error('[auth/otp/verify]', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        return res.json({ success: true, user });
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

module.exports = router;
