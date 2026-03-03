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
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// ── File Upload Setup ─────────────────────────────────────────────────────────
// On Render: use the mounted persistent disk. In dev: local uploads/ folder.
const UPLOAD_DIR = process.env.UPLOAD_DIR
    || (process.env.NODE_ENV === 'production' ? '/var/data/uploads' : path.join(__dirname, '..', 'uploads'));
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || 500) * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only video files are allowed'));
    },
});

// ── Static File Serving (Uploaded Videos) ────────────────────────────────────
// Enable range requests so the browser can seek in video files
app.use('/uploads', express.static(UPLOAD_DIR, {
    setHeaders: (res) => {
        res.setHeader('Accept-Ranges', 'bytes');
    },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Video upload endpoint
app.post('/api/upload', (req, res, next) => {
    // Verify token before upload
    const { authenticate } = require('./middleware/auth');
    authenticate(req, res, () => {
        upload.single('video')(req, res, (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }
            // In production return the full backend URL so all clients can load the file
            const host = process.env.NODE_ENV === 'production'
                ? (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`)
                : '';
            const fileUrl = `${host}/uploads/${req.file.filename}`;
            res.json({ success: true, url: fileUrl, filename: req.file.originalname, size: req.file.size });
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
