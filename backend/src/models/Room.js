const mongoose = require('mongoose');
const { ROOM_TYPE, VIDEO_TYPE, DEFAULT_PARTICIPANT_LIMIT } = require('../config/constants');

/**
 * Room Schema
 * Stores persistent room data. Live session state (participants online,
 * exact video position) is maintained in the server's in-memory roomStore.
 */
const roomSchema = new mongoose.Schema(
    {
        // Short 6-char code used in URLs and for joining (e.g. "AB12CD")
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60,
        },
        hostId: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: Object.values(ROOM_TYPE),
            default: ROOM_TYPE.PUBLIC,
        },
        // Optional password for private rooms
        password: {
            type: String,
            default: null,
        },
        participantLimit: {
            type: Number,
            default: DEFAULT_PARTICIPANT_LIMIT,
            min: 2,
            max: 50,
        },
        // Current video being watched
        currentVideo: {
            url: String,         // File path or YouTube video ID or direct URL
            type: {
                type: String,
                enum: Object.values(VIDEO_TYPE),
                default: VIDEO_TYPE.FILE,
            },
            title: String,
        },
        // Last known video playback state (synced from live session)
        videoState: {
            currentTime: { type: Number, default: 0 },
            isPlaying: { type: Boolean, default: false },
            lastUpdated: { type: Date, default: Date.now },
        },
        // Soft list of users who have ever joined (for history)
        participantHistory: [
            {
                userId: String,
                username: String,
                joinedAt: Date,
            },
        ],
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
