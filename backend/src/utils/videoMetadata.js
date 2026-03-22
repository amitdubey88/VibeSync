const https = require('https');

/**
 * Helper to fetch video metadata from external sources (oEmbed, etc)
 * Supports YouTube, Direct link (filename extraction), and HLS.
 */
async function getVideoMetadata(url, type) {
    if (!url) return null;

    if (type === 'youtube') {
        // Clean URL for oEmbed
        const cleanUrl = url.includes('youtube.com') || url.includes('youtu.be') 
            ? url 
            : `https://www.youtube.com/watch?v=${url}`;
            
        return new Promise((resolve) => {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
            const req = https.get(oembedUrl, (res) => {
                if (res.statusCode !== 200) return resolve(null);
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.title || null);
                    } catch { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(3000, () => { req.destroy(); resolve(null); });
        });
    }
    
    // Direct link title extraction (extract filename)
    if (type === 'direct' || type === 'hls' || type === 'file' || type === 'url') {
        try {
            const parts = url.split('/').pop().split('?')[0];
            if (parts) {
                const name = decodeURIComponent(parts).replace(/\.[a-z0-9]+$/i, '');
                return name || null;
            }
        } catch { return null; }
    }
    
    return null;
}

module.exports = { getVideoMetadata };
