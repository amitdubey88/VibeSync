import { useEffect, useRef, useState } from 'react';
import { useRoom } from '../../context/RoomContext';
import { Loader2 } from 'lucide-react';

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
    this.readyState = 0; // 0 = HAVE_NOTHING, 1 = HAVE_METADATA, etc.
    this._playbackRate = 1.0;
    this._muted = false;
  }

  // --- HTML5 Media API Getters ---

  get currentTime() {
    try {
      return this.ytPlayer.getCurrentTime() || 0;
    } catch { return 0; }
  }

  set currentTime(time) {
    try {
      this.ytPlayer.seekTo(time, true);
      // Emit seeked instantly to update React state
      this.dispatchEvent(new Event('seeked'));
    } catch {}
  }

  get duration() {
    try {
      return this.ytPlayer.getDuration() || Infinity;
    } catch { return Infinity; }
  }

  get paused() {
    try {
      const state = this.ytPlayer.getPlayerState();
      // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 video cued
      return state !== 1 && state !== 3;
    } catch { return true; }
  }

  get playbackRate() {
    return this._playbackRate;
  }

  set playbackRate(rate) {
    this._playbackRate = rate;
    try {
      this.ytPlayer.setPlaybackRate(rate);
    } catch {}
  }

  get muted() {
    return this._muted;
  }

  set muted(value) {
    this._muted = value;
    try {
      if (value) this.ytPlayer.mute();
      else this.ytPlayer.unMute();
    } catch {}
  }

  get volume() {
    try {
      return this.ytPlayer.getVolume() / 100;
    } catch { return 1; }
  }

  set volume(value) {
    try {
      this.ytPlayer.setVolume(value * 100);
      if (value > 0 && this.muted) this.muted = false;
    } catch {}
  }

  // --- HTML5 Media API Methods ---

  async play() {
    try {
      this.ytPlayer.playVideo();
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  pause() {
    try {
      this.ytPlayer.pauseVideo();
    } catch {}
  }

  // --- Methods internally called by the React Component ---
  
  _setReadyMap() {
    this.readyState = 4; // HAVE_ENOUGH_DATA
    this.dispatchEvent(new Event('loadedmetadata'));
    this.dispatchEvent(new Event('canplay'));
  }

  _handleStateChange(event) {
    const YT = window.YT;
    // YT.PlayerState: PLAYING(1), PAUSED(2), BUFFERING(3), ENDED(0), CUED(5)
    
    // Simulate timeupdate for progress bars
    this.dispatchEvent(new Event('timeupdate'));

    switch (event.data) {
      case YT.PlayerState.PLAYING:
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
    console.error('[YouTubeProxy] Error:', event.data);
    this.dispatchEvent(new Event('error'));
  }
}


/**
 * YouTubePlayer Component
 * 
 * Renders the YouTube iframe and emits a `YouTubeVideoProxy` instance via `onReady`.
 * This component intentionally strips all custom VideoControls, ReactionBurst, 
 * Sync Badges, and WebRTC logic, because those are supplied uniformly by `VideoPlayer.jsx`
 * for ANY video element we pass it (HTML5 <video> or this proxy).
 */
const YouTubePlayer = ({ videoId, onReady }) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const proxyRef = useRef(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    // Load YouTube Iframe API script if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!active || !containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { 
          controls: 0, // We always hide native controls to use our unified custom VideoControls
          rel: 0, 
          modestbranding: 1,
          fs: 0,
          disablekb: 1, // We handle custom keyboard shortcuts in VideoPlayer.jsx
          iv_load_policy: 3,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            if (!active) return;
            setIsInitializing(false);
            
            // Create the proxy adapter
            const proxy = new YouTubeVideoProxy(event.target);
            proxyRef.current = proxy;
            proxy._setReadyMap();
            
            // Hand the proxy up to VideoPlayer so useVideoSync hooks into it!
            if (onReady) onReady(proxy);
          },
          onStateChange: (event) => {
            if (!active || !proxyRef.current) return;
            proxyRef.current._handleStateChange(event);
          },
          onError: (event) => {
            if (!active || !proxyRef.current) return;
            proxyRef.current._handleError(event);
          }
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      active = false;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
      if (onReady) {
        onReady(null); // Cleanup proxy ref on unmount
      }
    };
  }, [videoId, onReady]);

  // Poll for timeupdates to drive the progress bar smoothly while streaming
  useEffect(() => {
    if (isInitializing) return;
    const interval = setInterval(() => {
      if (proxyRef.current && !proxyRef.current.paused) {
        proxyRef.current.dispatchEvent(new Event('timeupdate'));
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isInitializing]);

  return (
    <div className="w-full h-full relative pointer-events-none group bg-black">
      <div 
        ref={containerRef} 
        className="w-full h-full pointer-events-none" 
      />
      
      {/* 
        Interaction Blocking Layer:
        Completely covers the iframe to prevent any native YouTube interactions (pausing, clicking links).
        Instead, users interact with the transparent overlay of VideoPlayer.jsx which catches clicks
        and shows the unified VideoControls.
      */}
      <div className="absolute inset-0 z-10 touch-manipulation select-none" />

      {isInitializing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <Loader2 className="w-10 h-10 text-accent-red animate-spin" />
        </div>
      )}
    </div>
  );
};

export { YouTubePlayer };
export default YouTubePlayer;
