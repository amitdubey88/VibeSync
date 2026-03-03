// Application-wide constants
module.exports = {
    // Room types
    ROOM_TYPE: {
        PUBLIC: 'public',
        PRIVATE: 'private',
    },

    // Video source types
    VIDEO_TYPE: {
        FILE: 'file',
        YOUTUBE: 'youtube',
        URL: 'url',
    },

    // Message types
    MESSAGE_TYPE: {
        TEXT: 'text',
        SYSTEM: 'system',
        REACTION: 'reaction',
    },

    // Default participant limit
    DEFAULT_PARTICIPANT_LIMIT: 20,

    // Max file size (in bytes): 500MB
    MAX_FILE_SIZE: 500 * 1024 * 1024,

    // Sync drift threshold in seconds
    DRIFT_THRESHOLD: 1.5,

    // Room code length
    ROOM_CODE_LENGTH: 6,
};
