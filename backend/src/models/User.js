const mongoose = require('mongoose');

/**
 * User Schema
 * Supports both authenticated users (email/OTP) and guest users.
 */
const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 30,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            sparse: true, // allows null for guests
        },
        // Gravatar-style avatar color index (0-9) or custom URL
        avatar: {
            type: String,
            default: null,
        },
        isGuest: {
            type: Boolean,
            default: false,
        },
        // OTP for email-based login
        otp: String,
        otpExpiry: Date,
        // Last seen timestamp
        lastSeen: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// Auto-generate avatar color from username if not set
userSchema.pre('save', function (next) {
    if (!this.avatar) {
        const colors = [
            '#e50914', '#8b5cf6', '#06b6d4', '#10b981',
            '#f59e0b', '#ef4444', '#3b82f6', '#ec4899',
        ];
        const idx = this.username.charCodeAt(0) % colors.length;
        this.avatar = colors[idx];
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
