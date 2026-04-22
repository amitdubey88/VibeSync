require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { cloudinary, isConfigured: isCloudinaryConfigured } = require('./config/cloudinary');

// Global Error Handlers - Keep server alive if AI or Async tasks fail
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('⚠️ [CRITICAL] Uncaught Exception:', err);
});

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const registerSocketHandlers = require('./socket');
const inviteRoutes = require('./routes/invite');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

// ── In-Memory Room Store ─────────────────────────────────────────────────────
// Map<roomCode: string, RoomData: object>
// This is the single source of truth for live session state.
const roomStore = new Map();
app.locals.roomStore = roomStore;

// ── Allowed origins whitelist ────────────────────────────────────────────────
// Always include the configured FRONTEND_URL. Add localhost for dev.
const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL || 'https://vibe-sync-pied.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
].filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true; // allow server-to-server / curl requests
    return ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o));
};

// ── Socket.IO Setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: (origin, cb) => {
            if (isAllowedOrigin(origin)) return cb(null, true);
            return cb(new Error('CORS: origin not allowed'));
        },
        credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
});

// ── Security Headers ─────────────────────────────────────────────────────────
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Only set HSTS in production (HTTPS)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// ── CORS — unified, single middleware, first in the stack ────────────────────
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// Sane body size limits — videos go through the dedicated /api/upload endpoint
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// File Upload Setup
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Serve uploads folder statically so we can fallback if Cloudinary fails
app.use('/uploads', express.static(UPLOAD_DIR));

const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

const upload = multer({
    storage: diskStorage,
    limits: { fileSize: 1024 * 1024 * 1024 }, // Supports up to 1GB for movies
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
            'video/x-matroska', 'video/x-msvideo', 'video/x-flv', 'video/mpeg',
            'application/octet-stream'
        ];
        if (allowed.includes(file.mimetype) || file.originalname.toLowerCase().match(/\.(mp4|mkv|webm|mov|avi|flv)$/)) {
            cb(null, true);
        } else {
            console.warn(`[upload] Rejected file type: ${file.mimetype} (${file.originalname})`);
            cb(new Error(`File type ${file.mimetype} not allowed. Please use MP4, MKV, or WebM.`));
        }
    },
});

const useCloudinary = isCloudinaryConfigured();
if (useCloudinary) console.log('📦 Upload mode: Cloudinary (Streaming Proxy)');
else console.log('📦 Upload mode: Local disk (dev)');

// ── Routes ────────────────────────────────────────────────────────────────────
const extRoutes = require('./routes/ext');
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/ext', extRoutes);   // Browser extension sync (no JWT)
app.use('/invite', inviteRoutes); // Feature 9: OG invite link preview
app.use('/api/notifications', notificationRoutes); // Feature 16: Web Push subscriptions

// Video upload endpoint
app.post('/api/upload', (req, res) => {
    const { authenticate } = require('./middleware/auth');
    authenticate(req, res, () => {
        // ALWAYS use the disk-based upload to accommodate large files reliably.
        // Even for Cloudinary, we save to temp disk first, then pipe to cloud.
        // This is much better than memoryStorage which causes crashes/timeouts.
        upload.single('video')(req, res, async (err) => {
            if (err) {
                console.warn('[upload] Multer error:', err.message);
                return res.status(400).json({ success: false, message: err.message });
            }
            if (!req.file) {
                console.warn('[upload] Missing file field "video"');
                return res.status(400).json({ success: false, message: 'No file uploaded or wrong field name' });
            }

            try {
                let fileUrl;
                if (useCloudinary) {
                    // Create a stream from the temporary file on disk
                    const fileStream = fs.createReadStream(req.file.path);

                    // Pipe the file stream to Cloudinary
                    const result = await new Promise((resolve, reject) => {
                        // Use 'auto' to let Cloudinary decide - this is more robust
                        // but we still include explicit chunking to handle larger files.
                        const cloudStream = cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'auto',
                                folder: 'vibesync',
                                chunk_size: 10000000, // 10MB chunks
                            },
                            (cloudErr, cloudResult) => {
                                if (cloudErr) {
                                    console.error('[upload] Cloudinary direct error:', cloudErr);
                                    reject(cloudErr);
                                }
                                else resolve(cloudResult);
                            }
                        );

                        // Handle stream errors
                        fileStream.on('error', (err) => {
                            console.error('[upload] File stream error:', err);
                            reject(err);
                        });
                        cloudStream.on('error', (err) => {
                            console.error('[upload] Cloud stream error:', err);
                            reject(err);
                        });

                        fileStream.pipe(cloudStream);
                    });

                    fileUrl = result.secure_url;

                    // Cleanup the temporary file from disk
                    fs.unlink(req.file.path, () => { });
                } else {
                    // Local dev: relative URL
                    fileUrl = `/uploads/${req.file.filename}`;
                }
                return res.json({ success: true, url: fileUrl, filename: req.file.originalname, size: req.file.size });
            } catch (uploadErr) {
                // FALLBACK: If Cloudinary fails due to size limit or format (E2EE files), use local server storage
                const errLower = (uploadErr.message || '').toLowerCase();
                const isLimit = errLower.includes('size too large') || errLower.includes('maximum is') || errLower.includes('limit');
                const isFormat = errLower.includes('format not supported') || errLower.includes('invalid file') || errLower.includes('invalid image');

                if (isLimit || isFormat) {
                    
                    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                    const host = req.get('host');
                    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

                    return res.json({
                        success: true,
                        url: fileUrl,
                        filename: req.file.originalname,
                        size: req.file.size,
                        note: 'Served from local server due to cloud size limits'
                    });
                }

                console.error('[upload] Cloud error:', uploadErr.message);
                if (req.file?.path) fs.unlink(req.file.path, () => { });
                return res.status(500).json({ success: false, message: 'Cloud upload failed: ' + uploadErr.message });
            }
        });
    });
});


// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        rooms: roomStore.size,
        timestamp: new Date().toISOString(),
    });
});

// 404 handler
app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found' }));

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[error]', err.message);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ── Socket Handler Registration ───────────────────────────────────────────────
registerSocketHandlers(io, roomStore);

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();
    server.listen(PORT, () => {
        console.log(`\n🚀 VibeSync server running on port ${PORT}`);
        
        
        
    });
};

startServer();

module.exports = { app, server };
