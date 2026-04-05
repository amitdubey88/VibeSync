import axios from 'axios';

// In dev: Vite proxy handles /api → localhost:5000
// In production: VITE_API_URL = https://your-render-app.onrender.com
const BASE_URL = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api`
    : '/api';

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('vibesync_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Auth ─────────────────────────────────────────────────────────────────────
export const loginAsGuest = (username) =>
    api.post('/auth/guest', { username }).then((r) => r.data);

export const sendOtp = (email) =>
    api.post('/auth/otp/send', { email }).then((r) => r.data);

export const verifyOtp = (email, otp, username) =>
    api.post('/auth/otp/verify', { email, otp, username }).then((r) => r.data);

export const getMe = () =>
    api.get('/auth/me').then((r) => r.data);

// ── Rooms ────────────────────────────────────────────────────────────────────
export const createRoom = (payload) =>
    api.post('/rooms', payload).then((r) => r.data);

export const getRoomInfo = (code) =>
    api.get(`/rooms/${code}`).then((r) => r.data);

export const joinRoom = (code, password, inviteToken) =>
    api.post(`/rooms/${code}/join`, { password, inviteToken }).then((r) => r.data);

export const getRoomMessages = (code) =>
    api.get(`/rooms/${code}/messages`).then((r) => r.data);

export const fetchVideoMetadata = (url, type) =>
    api.get('/rooms/video/metadata', { params: { url, type } }).then((r) => r.data);

// ── Video Upload ──────────────────────────────────────────────────────────────

/**
 * Uploads a file using our optimized streaming proxy.
 */
export const uploadVideo = async (file, onProgress) => {
    const form = new FormData();
    form.append('video', file);

    return api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0, // Disable timeout for large video uploads
        onUploadProgress: (evt) => {
            if (onProgress) {
                const pct = Math.round((evt.loaded * 100) / (evt.total || evt.loaded));
                onProgress(pct);
            }
        },
    }).then((r) => r.data);
};

export default api;
