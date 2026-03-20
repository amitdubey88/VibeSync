const jwt = require('jsonwebtoken');

// ── Startup guard ─────────────────────────────────────────────────────────────
// Fail hard and fast if the secret is missing rather than letting every request
// silently collapse at runtime with a cryptic jwt error.
if (!process.env.JWT_SECRET) {
    throw new Error('[auth] JWT_SECRET is not defined. Set it in your environment before starting the server.');
}

/**
 * Extracts the raw JWT string from the Authorization header.
 * Returns null when the header is absent or malformed.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7); // More efficient than split(' ')[1]
    }
    return null;
};

/**
 * @typedef {Object} JwtUserPayload
 * @property {string} id      - MongoDB user _id stringified
 * @property {string} username
 * @property {string} email
 * @property {number} iat     - Issued-at timestamp (seconds)
 * @property {number} exp     - Expiry timestamp (seconds)
 */

/**
 * Mandatory JWT authentication middleware.
 * Verifies the Bearer token from the Authorization header and attaches the
 * decoded payload to `req.user`. Distinguishes expired tokens from invalid ones
 * so the client can handle each case appropriately (e.g. trigger a token refresh).
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const authenticate = (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        /** @type {JwtUserPayload} */
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ success: false, message: 'Token expired' });
        }
        if (err instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        // Unexpected error (e.g. cannot read secret) — let the global error handler deal with it
        next(err);
    }
};

/**
 * Optional auth — attaches user if a valid token exists, continues either way.
 * Used for endpoints accessible to both guests and authenticated users.
 * Only swallows JWT-specific errors; unexpected errors are re-thrown so they
 * surface in the global error handler rather than being silently swallowed.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const optionalAuth = (req, res, next) => {
    const token = extractToken(req);
    if (token) {
        try {
            /** @type {JwtUserPayload} */
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError || err instanceof jwt.JsonWebTokenError) {
                // Known JWT errors — treat as unauthenticated and continue
            } else {
                // Unexpected error — bubble up to the global error handler
                return next(err);
            }
        }
    }
    next();
};

module.exports = { authenticate, optionalAuth };
