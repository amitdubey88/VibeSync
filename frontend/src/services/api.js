import axios from 'axios';

// In dev: Vite proxy handles /api → localhost:5000
// In production: VITE_API_URL = https://your-render-app.onrender.com
const BASE_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
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

export const joinRoom = (code, password) =>
    api.post(`/rooms/${code}/join`, { password }).then((r) => r.data);

export const getRoomMessages = (code) =>
    api.get(`/rooms/${code}/messages`).then((r) => r.data);

// ── Video Upload ──────────────────────────────────────────────────────────────

/**
 * Fetches a signature for direct Cloudinary upload.
 */
export const getUploadSignature = () =>
    api.get('/upload/sign').then((r) => r.data);

/**
 * Uploads a file directly to Cloudinary (fastest) or our server (local dev fallback).
 */
export const uploadVideo = async (file, onProgress) => {
    try {
        // 1. Try to get a Cloudinary signature for direct upload
        const signData = await getUploadSignature();

        if (signData.success) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', signData.apiKey);
            formData.append('timestamp', signData.timestamp);
            formData.append('signature', signData.signature);
            formData.append('folder', signData.folder);

            const cloudUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/video/upload`;

            const response = await axios.post(cloudUrl, formData, {
                onUploadProgress: (evt) => {
                    if (onProgress) {
                        const pct = Math.round((evt.loaded * 100) / (evt.total || evt.loaded));
                        onProgress(pct);
                    }
                },
            });

            return { url: response.data.secure_url };
        }
    } catch (err) {
        console.warn('[upload] Direct upload to Cloudinary skipped or failed, falling back to server:', err.message);
    }

// 2. Fallback: Upload to our own server (used in local dev or if Cloudinary is misconfigured)
    const form = new FormData();
    form.append('video', file);
    return api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0, 
        onUploadProgress: (evt) => {
            if (onProgress) {
                const pct = Math.round((evt.loaded * 100) / (evt.total || evt.loaded));
                onProgress(pct);
            }
        },
    }).then((r) => r.data);
};

export default api;
