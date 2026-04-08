/**
 * Pick an avatar color by cycling through a palette based on username.
 */
export const getAvatarColor = (username = '') => {
    const palette = [
        '#e50914', '#8b5cf6', '#06b6d4', '#10b981',
        '#f59e0b', '#ef4444', '#3b82f6', '#ec4899',
        '#14b8a6', '#f97316',
    ];
    const idx = (username.charCodeAt(0) || 0) % palette.length;
    return palette[idx];
};

/**
 * Get initials (up to 2 chars) from a username.
 */
export const getInitials = (username = '') =>
    username.slice(0, 2).toUpperCase();

/**
 * Format seconds into mm:ss or h:mm:ss.
 */
export const formatTime = (seconds) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Extract YouTube video ID from a YouTube URL.
 * Returns null if not a YouTube URL.
 */
export const extractYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
        /(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
        const match = url.match(p);
        if (match) return match[1];
    }
    return null;
};

/**
 * Detect video source type from URL.
 */
export const detectVideoType = (url) => {
    if (!url) return null;
    if (extractYouTubeId(url)) return 'youtube';
    if (/\.(mp4|webm|ogg|mov|m4v|mkv|avi|wmv|flv|3gp)(\?.*)?$/i.test(url)) return 'file';
    return 'url';
};

/**
 * Clamp a value between min and max.
 */
export const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * Format a date to a human-readable time (HH:MM AM/PM).
 */
export const formatMessageTime = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

/**
 * Format date to relative time (e.g., "5m ago", "Just now").
 */
export const formatRelativeTime = (isoStr) => {
    const now = new Date();
    const past = new Date(isoStr);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return past.toLocaleDateString();
};

/**
 * Generate a random username for guests.
 */
export const generateGuestName = () => {
    const adjectives = ['Cool', 'Speedy', 'Dark', 'Cosmic', 'Neon', 'Chill', 'Epic', 'Vibe'];
    const nouns = ['Panda', 'Fox', 'Hawk', 'Wolf', 'Star', 'Comet', 'Pixel', 'Ninja'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 99)}`;
};
