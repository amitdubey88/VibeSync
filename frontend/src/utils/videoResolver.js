/**
 * Parses a raw URL string and determines the underlying video type and source payload.
 *
 * @param {string} url - The raw user input (full URL, shortened URL, or bare YouTube ID).
 * @returns {{ url: string, type: 'youtube' | 'direct' | 'hls' | 'unsupported', title: string } | null}
 *          Returns null if the input is empty or fundamentally invalid.
 */
export const resolveVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const rawUrl = url.trim();
  if (!rawUrl) return null;

  // 1. YouTube Validation
  // Matches all known YouTube URL formats:
  //   youtube.com/watch?v=ID  (standard)
  //   youtube.com/watch?v=ID&t=30s  (with timestamp)
  //   youtu.be/ID  (shortened)
  //   youtube.com/embed/ID  (embedded)
  //   youtube.com/shorts/ID  (Shorts)
  //   youtube.com/live/ID  (Live replay)
  //   youtube.com/v/ID  (old API format)
  //   music.youtube.com/watch?v=ID  (YouTube Music)
  //   Bare 11-character video ID
  const ytRegex = /(?:youtu\.be\/|(?:www\.|m\.|music\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/;
  const ytMatch = rawUrl.match(ytRegex);

  if (ytMatch && ytMatch[1]) {
    return {
      url: ytMatch[1], // Return the 11-char ID for the YouTube iframe API
      type: 'youtube',
      title: `YouTube Video (${ytMatch[1]})`,
    };
  }

  // Handle bare 11-char YouTube ID (no URL prefix)
  if (/^[a-zA-Z0-9_-]{11}$/.test(rawUrl)) {
    return {
      url: rawUrl,
      type: 'youtube',
      title: `YouTube Video (${rawUrl})`,
    };
  }

  // Only proceed with URL-based checks for valid http(s) URLs
  let parsedUrl = null;
  const isHttpUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
  if (isHttpUrl) {
    try { parsedUrl = new URL(rawUrl); } catch (_) {}
  }

  // 2. HLS Stream Validation (.m3u8)
  const hlsRegex = /\.m3u8(\?.*)?$/i;
  if (hlsRegex.test(rawUrl)) {
    let fileName = 'Live Stream';
    try {
      const pathPart = (parsedUrl?.pathname || rawUrl).split('/').pop().split('?')[0];
      if (pathPart) fileName = decodeURIComponent(pathPart).replace(/\.m3u8$/i, '');
    } catch (_) {}
    return { url: rawUrl, type: 'hls', title: fileName || 'Live Stream' };
  }

  // 3. Direct Video Link Validation
  // Matches common media extensions with optional query strings
  const directVideoRegex = /\.(mp4|webm|ogg|mov|m4v|mkv|avi|wmv|flv|3gp)(\?.*)?$/i;
  if (directVideoRegex.test(rawUrl)) {
    let fileName = 'Direct Video';
    try {
      const pathPart = (parsedUrl?.pathname || rawUrl).split('/').pop().split('?')[0];
      if (pathPart) {
        // Decode URI and strip extension for a cleaner display title
        fileName = decodeURIComponent(pathPart).replace(/\.[a-z0-9]+$/i, '');
        if (!fileName) fileName = decodeURIComponent(pathPart);
      }
    } catch (_) {
      const parts = rawUrl.split('/').pop().split('?')[0];
      if (parts) fileName = decodeURIComponent(parts);
    }
    return { url: rawUrl, type: 'direct', title: fileName };
  }

  // 4. Unsupported http(s) URL
  if (isHttpUrl) {
    return { url: rawUrl, type: 'unsupported', title: 'Unsupported Link' };
  }

  // 5. Completely unrecognized input
  return null;
};
