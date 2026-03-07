const crypto = require('crypto');

/**
 * Modern hashing utility for room identifiers.
 * Uses HMAC-SHA256 with a server-side secret to ensure room codes 
 * are irreversible even if the database is compromised.
 */

const HASH_SECRET = process.env.HASH_SECRET || 'vibesync-fallback-secret-2026';

/**
 * Hashes a room code (e.g. "AB12CD") into a unique, irreversible string.
 */
function hashRoomCode(code) {
    if (!code) return null;
    return crypto
        .createHmac('sha256', HASH_SECRET)
        .update(code.toUpperCase())
        .digest('hex');
}

module.exports = {
    hashRoomCode
};
