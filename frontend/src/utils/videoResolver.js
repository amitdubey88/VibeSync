/**
 * Parses a raw URL string and determines the underlying video type and source payload.
 *
 * @param {string} url - The raw user input URL.
 * @returns {{ url: string, type: 'youtube' | 'direct' | 'hls' | 'unsupported', title: string } | null}
 *          Returns null if the input is empty or fundamentally invalid.
 */
export const resolveVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const rawUrl = url.trim();
  if (!rawUrl) return null;

  // 1. YouTube Validation
  // Matches: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
  const ytRegex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/;
  const ytMatch = rawUrl.match(ytRegex);
  
  if (ytMatch && ytMatch[1]) {
    return {
      url: ytMatch[1], // We return just the 11-char ID for the YouTube iframe API
      type: 'youtube',
      title: 'YouTube Video'
    };
  }

  // 2. HLS Stream Validation (.m3u8)
  const hlsRegex = /\.m3u8(\?.*)?$/i;
  if (hlsRegex.test(rawUrl)) {
    let fileName = 'Live Stream';
    try {
      const parts = rawUrl.split('/').pop().split('?')[0];
      if (parts) fileName = decodeURIComponent(parts);
    } catch (_) {}
    
    return {
      url: rawUrl,
      type: 'hls',
      title: fileName
    };
  }

  // 3. Direct Video Link Validation
  // Looks for common media extensions with optional query strings
  const directVideoRegex = /\.(mp4|webm|ogg|mov|m4v|mkv|avi|wmv|flv|3gp)(\?.*)?$/i;
  
  if (directVideoRegex.test(rawUrl)) {
    // Extract a default title from the filename
    let fileName = 'Direct Video';
    try {
      const urlObj = new URL(rawUrl);
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart) {
        fileName = decodeURIComponent(lastPart);
      }
    } catch (e) {
      // Fallback if URL parsing fails (e.g. relative path)
      const parts = rawUrl.split('/').pop().split('?')[0];
      if (parts) fileName = decodeURIComponent(parts);
    }

    return {
      url: rawUrl,
      type: 'direct',
      title: fileName
    };
  }

  // 4. Fallback: it's a URL but we don't natively support it right now
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return {
      url: rawUrl,
      type: 'unsupported',
      title: 'Unsupported Link'
    };
  }

  return null;
};
