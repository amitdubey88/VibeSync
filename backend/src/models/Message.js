const mongoose = require('mongoose');
const { MESSAGE_TYPE } = require('../config/constants');

/**
 * Message Schema
 * Stores all chat messages. System messages (join/leave) have type = 'system'.
 */
const messageSchema = new mongoose.Schema(
    {
        roomId: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: String,
            required: true,
        },
        username: {
            type: String,
            required: true,
        },
        avatar: String,
        content: {
            type: String,
            required: true,
            maxlength: 2000,
        },
        type: {
            type: String,
            enum: Object.values(MESSAGE_TYPE),
            default: MESSAGE_TYPE.TEXT,
        },
    },
    { timestamps: true }
);

// Index for efficient room-based chat history retrieval
messageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
