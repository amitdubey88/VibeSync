require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { cloudinary, uploadToCloudinary, isConfigured: isCloudinaryConfigured } = require('./config/cloudinary');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const registerSocketHandlers = require('./socket');

const app = express();
const server = http.createServer(app);

// ── In-Memory Room Store ─────────────────────────────────────────────────────
// Map<roomCode: string, RoomData: object>
// This is the single source of truth for live session state.
const roomStore = new Map();
app.locals.roomStore = roomStore;

// ── CORS origin list ─────────────────────────────────────────────────────────
// FRONTEND_URL can be a comma-separated list:
//   e.g. "https://vibesync.vercel.app,http://localhost:5173"
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',').map((s) => s.trim());

const corsOriginFn = (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return cb(null, true);
    // Allow explicitly listed origins and well-known deployment platforms
    if (allowedOrigins.includes(origin) ||
        origin === 'http://localhost:5174' ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.koyeb.app') ||
        origin.endsWith('.vorcel.app') ||   // Vorcel deployment platform
        origin.endsWith('.netlify.app') ||  // Netlify deployments
        origin.endsWith('.render.com') ||   // Render deployments
        origin.endsWith('.onrender.com') ||
        origin.startsWith('chrome-extension://')) {
        return cb(null, true);
    }
    // IMPORTANT: Use cb(null, false) NOT cb(new Error(...)).
    // Calling cb(new Error()) routes through Express's global error handler which
    // sends the response BEFORE the cors middleware can set 'Access-Control-Allow-Origin',
    // causing the browser to report "No 'Access-Control-Allow-Origin' header is present".
    // cb(null, false) lets the cors package send a proper 403 with correct headers.
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(null, false);
};

// ── Socket.IO Setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: { origin: corsOriginFn, methods: ['GET', 'POST'], credentials: true },
    pingInterval: 10000,
    pingTimeout: 5000,
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow video serving
}));
app.use(cors({ origin: corsOriginFn, credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
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
                    console.log(`[upload] Cloudinary fallback triggered (${isLimit ? 'Limit' : 'Format'}). Local serving: ${req.file.originalname}`);
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
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Frontend:    ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
        console.log(`   Health:      http://localhost:${PORT}/api/health\n`);
    });
};

startServer();

module.exports = { app, server };
