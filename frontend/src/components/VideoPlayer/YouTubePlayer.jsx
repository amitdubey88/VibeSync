import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// ── YouTube URL → Video ID extractor ─────────────────────────────────────────
// Handles all known YouTube URL formats:
//   https://www.youtube.com/watch?v=ID
//   https://youtu.be/ID
//   https://youtube.com/embed/ID
//   https://youtube.com/shorts/ID
//   https://youtube.com/live/ID
//   https://music.youtube.com/watch?v=ID
//   Bare 11-character video ID (already extracted upstream)
const extractYouTubeId = (input) => {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();

  // Already a bare 11-char ID (passed from videoResolver)
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  // Full URL extraction
  const match = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|music\.youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

// ── Global YT API bootstrap (queue-based, race-condition safe) ────────────────
// Problem: window.onYouTubeIframeAPIReady is a single global slot.
// If two YouTubePlayer components mount before the API loads, the second
// assignment clobbers the first — meaning the first player never initializes.
// Solution: maintain a global queue of pending callbacks and drain it once
// the API fires. Only one <script> tag is ever inserted.
const ensureYouTubeApiLoaded = (callback) => {
  // If API already ready, call immediately
  if (window.YT && window.YT.Player) {
    callback();
    return;
  }

  // Initialize the queue on first use
  if (!window._ytReadyQueue) {
    window._ytReadyQueue = [];
  }
  window._ytReadyQueue.push(callback);

  // Only inject script if not already present
  const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
  if (!existing) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
  }

  // Install the global handler only once
  if (!window.onYouTubeIframeAPIReady) {
    window.onYouTubeIframeAPIReady = () => {
      const queue = window._ytReadyQueue || [];
      window._ytReadyQueue = [];
      queue.forEach((fn) => fn());
    };
  }
};


/**
 * YouTubeVideoProxy
 *
 * Adapts the YouTube Iframe Player API to match the standard HTML5 HTMLVideoElement API.
 * This allows hooks like `useVideoSync` to interact with a YouTube video
 * exactly as if it were a local `.mp4` file.
 */
class YouTubeVideoProxy extends EventTarget {
  constructor(ytPlayer) {
    super();
    this.ytPlayer = ytPlayer;
    this.readyState = 0; // 0 = HAVE_NOTHING
    this._playbackRate = 1.0;
    this._muted = false;
  }

  // --- HTML5 Media API Getters ---

  get currentTime() {
    if (this._pendingSeekTime !== undefined && this._pendingSeekTime !== null) {
      return this._pendingSeekTime;
    }
    try { return this.ytPlayer.getCurrentTime() || 0; } catch { return 0; }
  }

  set currentTime(time) {
    this._pendingSeekTime = time;
    try {
      this.dispatchEvent(new Event('seeking'));
      this.ytPlayer.seekTo(time, true);
      // Force an immediate timeupdate so the UI reflects the seek target instantly
      this.dispatchEvent(new Event('timeupdate'));
      
      // Give YouTube API a delay to update its internal clock before firing the event,
      // ensuring useVideoSync reads the new target time, not the old unmodified time.
      setTimeout(() => {
        this.dispatchEvent(new Event('seeked'));
        this._pendingSeekTime = null;
      }, 50);
    } catch {}
  }

  get duration() {
    try {
      const d = this.ytPlayer.getDuration();
      return (d && d > 0) ? d : 0;
    } catch { return 0; }
  }

  get buffered() {
    try {
      const fraction = this.ytPlayer.getVideoLoadedFraction() || 0;
      const d = this.duration;
      if (d > 0) {
        // Return a TimeRanges-like object structure for compatibility
        return {
          length: 1,
          start: () => 0,
          end: (i) => fraction * d
        };
      }
    } catch {}
    return { length: 0, start: () => 0, end: () => 0 };
  }

  get paused() {
    try {
      const state = this.ytPlayer.getPlayerState();
      return state !== 1 && state !== 3; // 1=playing, 3=buffering
    } catch { return true; }
  }

  get playbackRate() { return this._playbackRate; }

  set playbackRate(rate) {
    this._playbackRate = rate;
    try { this.ytPlayer.setPlaybackRate(rate); } catch {}
  }

  get muted() { return this._muted; }

  set muted(value) {
    this._muted = value;
    try {
      if (value) this.ytPlayer.mute();
      else this.ytPlayer.unMute();
    } catch {}
  }

  get volume() {
    try { return this.ytPlayer.getVolume() / 100; } catch { return 1; }
  }

  set volume(value) {
    try {
      this.ytPlayer.setVolume(value * 100);
      if (value > 0 && this._muted) { this._muted = false; }
    } catch {}
  }

  // --- HTML5 Media API Methods ---

  async play() {
    try { this.ytPlayer.playVideo(); return Promise.resolve(); }
    catch (err) { return Promise.reject(err); }
  }

  pause() {
    try { this.ytPlayer.pauseVideo(); } catch {}
  }

  // --- Internal hooks called by the React component ---

  _setReady() {
    this.readyState = 4; // HAVE_ENOUGH_DATA
    this.dispatchEvent(new Event('loadedmetadata'));
    this.dispatchEvent(new Event('canplay'));
  }

  _handleStateChange(event) {
    const YT = window.YT;
    this.dispatchEvent(new Event('timeupdate'));

    switch (event.data) {
      case YT.PlayerState.PLAYING:
        this.dispatchEvent(new Event('canplay'));
        this.dispatchEvent(new Event('play'));
        this.dispatchEvent(new Event('playing'));
        break;
      case YT.PlayerState.PAUSED:
        this.dispatchEvent(new Event('pause'));
        break;
      case YT.PlayerState.BUFFERING:
        this.dispatchEvent(new Event('waiting'));
        break;
      case YT.PlayerState.ENDED:
        this.dispatchEvent(new Event('pause'));
        this.dispatchEvent(new Event('ended'));
        break;
      default:
        break;
    }
  }

  _handleError(event) {
    // YT error codes: 2=invalid ID, 5=HTML5 error, 100=not found/private,
    // 101/150=embedding disabled by owner
    console.error('[YouTubeProxy] Error code:', event.data);
    this.dispatchEvent(new CustomEvent('error', { detail: { code: event.data } }));
  }
}


// ── Error code → human message ────────────────────────────────────────────────
const ytErrorMessage = (code) => {
  switch (code) {
    case 2:   return 'Invalid video ID. Please check the link.';
    case 100: return 'This video is private or does not exist.';
    case 101:
    case 150: return 'This video cannot be embedded (disabled by the owner).';
    case 5:   return 'HTML5 player error. Try a different video.';
    default:  return 'YouTube player error. Please try again.';
  }
};


/**
 * YouTubePlayer Component
 *
 * Renders the YouTube iframe and emits a `YouTubeVideoProxy` instance via `onReady`.
 * All playback controls, sync logic, and reactions are handled uniformly by VideoPlayer.jsx.
 */
const YouTubePlayer = ({ videoId: rawVideoId, onReady, onError }) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const proxyRef = useRef(null);
  const activeRef = useRef(true); // Tracks whether the component is still mounted
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorInfo, setErrorInfo] = useState(null);

  // Extract the video ID defensively — whether we receive a bare ID or full URL
  const videoId = extractYouTubeId(rawVideoId);

  const handleRetry = useCallback(() => {
    setStatus('loading');
    setErrorInfo(null);
    // Destroy old player if any
    if (playerRef.current && typeof playerRef.current.destroy === 'function') {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    proxyRef.current = null;
  }, []);

  useEffect(() => {
    activeRef.current = true;

    if (!videoId) {
      setStatus('error');
      setErrorInfo({ message: 'Invalid or unrecognized YouTube link.' });
      return;
    }

    setStatus('loading');
    setErrorInfo(null);

    const initPlayer = () => {
      if (!activeRef.current || !containerRef.current) return;

      // If player already exists, destroy it before making a new one
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
        proxyRef.current = null;
      }

      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            controls: 0,       // Use our own unified VideoControls
            rel: 0,
            modestbranding: 1,
            fs: 0,
            disablekb: 1,      // Keyboard shortcuts handled by VideoPlayer.jsx
            iv_load_policy: 3, // No video annotations
            playsinline: 1,
            enablejsapi: 1,
          },
          events: {
            onReady: (event) => {
              if (!activeRef.current) return;
              const proxy = new YouTubeVideoProxy(event.target);
              proxyRef.current = proxy;
              proxy._setReady();
              setStatus('ready');
              if (onReady) onReady(proxy);
            },
            onStateChange: (event) => {
              if (!activeRef.current || !proxyRef.current) return;
              proxyRef.current._handleStateChange(event);
            },
            onError: (event) => {
              if (!activeRef.current) return;
              const msg = ytErrorMessage(event.data);
              setStatus('error');
              setErrorInfo({ message: msg, code: event.data });
              if (proxyRef.current) proxyRef.current._handleError(event);
              if (onError) onError(event.data);
            },
          },
        });
      } catch (err) {
        console.error('[YouTubePlayer] Failed to create YT.Player:', err);
        if (activeRef.current) {
          setStatus('error');
          setErrorInfo({ message: 'Failed to initialize YouTube player.' });
        }
      }
    };

    ensureYouTubeApiLoaded(initPlayer);

    return () => {
      activeRef.current = false;
      // Remove this component's init callback from the queue if it hasn't fired yet
      if (window._ytReadyQueue) {
        window._ytReadyQueue = window._ytReadyQueue.filter((fn) => fn !== initPlayer);
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      proxyRef.current = null;
      if (onReady) onReady(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]); // Re-initialize only when video ID changes; onReady is stable via useCallback in parent

  // Poll timeupdate while playing for smooth progress bar
  useEffect(() => {
    if (status !== 'ready') return;
    const interval = setInterval(() => {
      if (proxyRef.current && !proxyRef.current.paused) {
        proxyRef.current.dispatchEvent(new Event('timeupdate'));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="w-full h-full relative bg-black">
      {/* YouTube iframe container wrapper to prevent React diffing issues when YT replaces the node */}
      <div 
        className="w-full h-full absolute inset-0 transition-opacity duration-500"
        style={{ opacity: status === 'ready' ? 1 : 0, pointerEvents: status === 'ready' ? 'auto' : 'none' }}
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/*
        Interaction Blocking Layer:
        Completely covers the iframe to prevent native YouTube clicks (pause, links, ads).
        Users interact with the transparent VideoPlayer overlay instead.
      */}
      {status === 'ready' && (
        <div className="absolute inset-0 z-0 touch-manipulation select-none" />
      )}

      {/* Loading State - only show if status is 'loading' to prevent double spinners with parent */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20 transition-opacity duration-300">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-accent-red animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white/90 font-bold text-xs">Loading YouTube Video</p>
            <p className="text-white/40 text-[10px] mt-1">Preparing playback…</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20 p-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-white font-semibold text-sm mb-1">Video Unavailable</p>
            <p className="text-white/50 text-xs">
              {errorInfo?.message || 'Unable to load this YouTube video.'}
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export { YouTubePlayer };
export default YouTubePlayer;
