import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoom } from '../../context/RoomContext';
import useVideoSync from '../../hooks/useVideoSync';
import useClockSync from '../../hooks/useClockSync';
import useBufferSync from '../../hooks/useBufferSync';
import VideoControls from './VideoControls';
import VideoPresenceOverlay from './VideoPresenceOverlay';
import YouTubePlayer from './YouTubePlayer';
import DirectVideoPlayer from './DirectVideoPlayer';
import HLSPlayer from './HLSPlayer';
import SyncStatusBadge from './SyncStatusBadge';
import ReactionBurst from './ReactionBurst';
import QuickReactionBar from './QuickReactionBar';
import { Play, Upload, Loader2, X, Clock, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import useWebRTC from '../../hooks/useWebRTC';
import useHostTransferSync from '../../hooks/useHostTransferSync';
import { decryptFile } from '../../utils/crypto';
import { resolveVideoUrl } from '../../utils/videoResolver';

// ── Full-screen portal modal ─────────────────────────────────────────────────
const SourcePickerModal = ({ onClose, onUrlSubmit, onFileUpload, urlInput, setUrlInput }) =>
  createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 pb-8 sm:pb-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-text-primary">Change Video</h3>
            <p className="text-text-muted text-xs mt-0.5">Replace the video for everyone in the room</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File upload */}
        <div className="space-y-3 mb-5">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Select Video File
          </label>
          
          <label className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all
            border-accent-red hover:border-accent-red/60 hover:bg-accent-red/5 cursor-pointer`}>
            <input type="file" accept="video/*" className="hidden" onChange={(e) => onFileUpload(e)} />
            <Zap className="w-6 h-6 text-accent-red" />
            <div className="text-center">
              <span className="text-xs font-bold text-text-primary">Stream Instantly</span>
              <p className="text-[10px] text-text-muted">Zero-wait WebRTC</p>
            </div>
          </label>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <hr className="flex-1 border-border-dark" />
          <span className="text-text-muted text-xs font-medium">OR</span>
          <hr className="flex-1 border-border-dark" />
        </div>

        {/* URL input */}
        <form onSubmit={onUrlSubmit}>
          <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            YouTube / Direct URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="https://youtube.com/watch?v=..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary px-5">Go</button>
          </div>
        </form>

        <button className="btn-ghost w-full mt-4 text-sm" onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body
  );

// ── Main VideoPlayer ─────────────────────────────────────────────────────────
const VideoPlayer = () => {
  const { currentVideo, videoState, room, isHost, setVideoSource, syncDuration } = useRoom();
  const { setPremierStream, remotePremierStream, isStreamAnnounced } = useWebRTC();
  const { hostChangedFlag } = useHostTransferSync();
  const videoRef = useRef(null);

  // Host-only blob URL — lets host play instantly from local file while uploading
  const [blobUrl, setBlobUrl] = useState(null);
  const blobUrlRef = useRef(null);

  // Decrypted video blob URL
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const decryptedUrlRef = useRef(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isDirectStreaming, setIsDirectStreaming] = useState(false);
  const [isLiveStreamingInitialized, setIsLiveStreamingInitialized] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoEl, setVideoEl] = useState(null);
  const controlsTimer = useRef(null);

  // Live ref so the callback can read playback position without stale closure
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  // Guards against re-capturing the stream on 'playing' events fired after seeking.
  // Once captureStream is active, seeking triggers 'playing' again — without this guard,
  // setPremierStream would tear down all participant connections on every seek.
  const isStreamingActiveRef = useRef(false);

  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    setVideoEl(el);
  }, []);

  const handlePlayerReady = useCallback((playerInstance) => {
    setVideoRef(playerInstance);
    setIsLoading(false);
  }, [setVideoRef]);

  useClockSync();
  const { syncStatus } = useVideoSync(videoEl);
  const { bufferingUsers } = useBufferSync(videoEl);

  // ── Auto-play for participants when videoEl mounts while host was already playing ──
  // useVideoSync handles live video:play events, but if the participant's video element
  // was not yet mounted when the event arrived (e.g., still decrypting), this effect
  // catches up as soon as the element becomes available.
  useEffect(() => {
    if (!videoEl || isHost) return;
    if (!videoState?.isPlaying) return;
    if (currentVideo?.type === 'live' || currentVideo?.type === 'uploading') return;

    // Compute adjusted target time accounting for elapsed wall-clock time since last update
    const elapsed = videoState.lastUpdated
      ? Math.max(0, (Date.now() - videoState.lastUpdated) / 1000)
      : 0;
    const targetTime = Math.max(0, (videoState.currentTime || 0) + elapsed);

    const doPlay = () => {
      if (targetTime > 0) videoEl.currentTime = targetTime;
      videoEl.play().catch(() => {});
    };

    if (videoEl.readyState >= 2) {
      doPlay();
    } else {
      videoEl.addEventListener('canplay', doPlay, { once: true });
      return () => videoEl.removeEventListener('canplay', doPlay);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl]); // Only re-run when videoEl mounts — videoState is read fresh from closure

  // ── Keep participant's live stream video srcObject in sync ─────────────────
  // We use a useEffect bound to the videoEl state. This guarantees no race
  // condition between inline refs setting srcObject but failing to call play().
  useEffect(() => {
    if (isHost || !videoEl) return;
    if (remotePremierStream && videoEl.srcObject !== remotePremierStream) {
      videoEl.srcObject = remotePremierStream;
      videoEl.play().catch(err => console.error('[Participant Live] AutoPlay blocked:', err));
    } else if (!remotePremierStream && videoEl.srcObject) {
      videoEl.srcObject = null;
    }
  }, [remotePremierStream, videoEl, isHost]);

  useEffect(() => {
    if (!videoEl) return;
    const onTimeUpdate = () => {
      setCurrentTime(videoEl.currentTime);
      currentTimeRef.current = videoEl.currentTime;
    };
    const onLoadedMetadata = () => setDuration(videoEl.duration);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlayEv = () => {
      isPlayingRef.current = true;
    };
    const onPlayingEv = () => {
      // For uploads, start broadcast immediately on play.
      // For live streams, only broadcast if the host explicitly clicked 'Start Streaming' first.
      const shouldBroadcast = isHost && (
        (currentVideo?.type === 'live' || isDirectStreaming) && isLiveStreamingInitialized
      );
      
      if (shouldBroadcast && videoEl.captureStream) {
        // BUGFIX: 'playing' fires after every seek (video resumes from new position).
        // Without this guard, every seek would call captureStream() again → setPremierStream()
        // which closes ALL existing video peer connections → blank screen + no audio for participants.
        // The captureStream API automatically tracks the video element's output across seeks,
        // so we only need to capture it ONCE when streaming starts.
        if (isStreamingActiveRef.current) return;

        // Delay captureStream slightly to ensure the video has actually painted a frame,
        // otherwise captureStream might return a stream of black frames.
        setTimeout(() => {
          try {
            const stream = videoEl.captureStream(50);
            isStreamingActiveRef.current = true;
            setPremierStream(stream);
          } catch (e) { console.error('[VideoPlayer] captureStream failed:', e); }
        }, 150);
      }
    };
    const onPauseEv = () => {
      isPlayingRef.current = false;
      // When host pauses, do NOT stop the stream.
      // captureStream keeps sending the frozen current frame — participants
      // see the paused frame rather than the 'Connecting to Feed...' screen.
      // Stream is only fully stopped on 'ended' or source change.
    };
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    videoEl.addEventListener('waiting', onWaiting);
    videoEl.addEventListener('canplay', onCanPlay);
    videoEl.addEventListener('play', onPlayEv);
    videoEl.addEventListener('playing', onPlayingEv);
    videoEl.addEventListener('pause', onPauseEv);
    videoEl.addEventListener('ended', onPauseEv);

    return () => {
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.removeEventListener('waiting', onWaiting);
      videoEl.removeEventListener('canplay', onCanPlay);
      videoEl.removeEventListener('play', onPlayEv);
      videoEl.removeEventListener('playing', onPlayingEv);
      videoEl.removeEventListener('pause', onPauseEv);
      videoEl.removeEventListener('ended', onPauseEv);
    };
  }, [videoEl, isHost, currentVideo?.type, isDirectStreaming, setPremierStream, isLiveStreamingInitialized]);

  // Stop streaming automatically when the host changes or removes the video source
  useEffect(() => {
    if (!isHost) return;
    setPremierStream(null);
    isStreamingActiveRef.current = false; // Reset so next stream start re-captures correctly
    setIsLiveStreamingInitialized(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.url]);

  // Reset local streaming state when host changes (driven by useHostTransferSync hook)
  useEffect(() => {
    if (hostChangedFlag && isHost) {
      console.log('[VideoPlayer] Host changed. Prepping clean slate for streaming.');
      setIsLiveStreamingInitialized(false);
      setPremierStream(null);
      isStreamingActiveRef.current = false;
    }
  }, [hostChangedFlag, isHost, setPremierStream]);

  // ── Keyboard Shortcuts (Space, Arrows, M) ────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in chat or inputs
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (!videoEl) return;

      switch(e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          if (isHost) {
            if (videoEl.paused) videoEl.play().catch(() => {});
            else videoEl.pause();
          }
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          if (isHost) {
            e.preventDefault();
            videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
          }
          break;
        case 'ArrowRight':
        case 'KeyL':
          if (isHost) {
            e.preventDefault();
            videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 10);
          }
          break;
        case 'KeyM':
          e.preventDefault();
          // Toggle mute locally (works for both host and guest)
          videoEl.muted = !videoEl.muted;
          // Dispatch a custom event so VideoControls can sync its UI state
          window.dispatchEvent(new CustomEvent('video:toggle-mute', { detail: videoEl.muted }));
          break;
        case 'KeyF':
          e.preventDefault();
          const container = videoEl.closest('.video-reaction-host');
          if (!container) return;
          if (!document.fullscreenElement) {
            if (container.requestFullscreen) container.requestFullscreen();
          } else {
            if (document.exitFullscreen) document.exitFullscreen();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, videoEl]);

  // Cleanup blob URLs on unmount
  useEffect(() => () => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    if (decryptedUrlRef.current) { URL.revokeObjectURL(decryptedUrlRef.current); decryptedUrlRef.current = null; }
  }, []);

  // Host: sync duration to room state once metadata/source is loaded
  useEffect(() => {
    if (isHost && duration > 0 && currentVideo && videoState && (!videoState.duration || videoState.duration === 0)) {
       // Just sync the duration instead of re-setting the whole source, 
       // to avoid race conditions with play/pause state
       syncDuration(duration);
    }
  }, [isHost, duration, currentVideo, videoState?.duration, syncDuration]);

  // When Cloudinary URL replaces blob URL: seek to saved position once metadata loads
  const pendingSeekRef = useRef(null);
  useEffect(() => {
    if (!videoEl || !pendingSeekRef.current) return;
    const { targetTime, shouldPlay } = pendingSeekRef.current;
    const doSeek = () => {
      videoEl.currentTime = targetTime;
      if (shouldPlay) videoEl.play().catch(() => {});
      pendingSeekRef.current = null;
    };
    // If metadata already loaded, seek immediately; otherwise wait for it
    if (videoEl.readyState >= 1) {
      doSeek();
    } else {
      const handler = () => { doSeek(); videoEl.removeEventListener('loadedmetadata', handler); };
      videoEl.addEventListener('loadedmetadata', handler);
      return () => videoEl.removeEventListener('loadedmetadata', handler);
    }
  }, [videoEl, currentVideo]);  // re-runs when currentVideo changes (blob → cloudinary swap)

  // ── Handle Encrypted Video Fetching & Decryption ───────────────────────────
  const { roomKey } = useRoom();
  useEffect(() => {
    // Only fetch/decrypt if it's an encrypted file and we aren't the host who already has a blobUrl
    if (!currentVideo || currentVideo.type === 'youtube' || !currentVideo.e2ee || blobUrl || !roomKey) {
      setDecryptedUrl(null);
      return;
    }

    let active = true;
    const fetchAndDecrypt = async () => {
      setIsDecrypting(true);
      try {
        const response = await fetch(currentVideo.url);
        const encryptedBlob = await response.blob();
        if (!active) return;

        const originalType = currentVideo.url.toLowerCase().split('.').pop();
        const mimeType = originalType === 'mkv' ? 'video/x-matroska' : `video/${originalType || 'mp4'}`;
        
        const decryptedBlob = await decryptFile(encryptedBlob, roomKey, mimeType);
        if (!active) return;

        const url = URL.createObjectURL(decryptedBlob);
        if (decryptedUrlRef.current) URL.revokeObjectURL(decryptedUrlRef.current);
        decryptedUrlRef.current = url;
        setDecryptedUrl(url);
      } catch (err) {
        console.error('Decryption failed:', err);
        // toast.error('Failed to decrypt video');
      } finally {
        if (active) setIsDecrypting(false);
      }
    };

    fetchAndDecrypt();
    return () => { active = false; };
  }, [currentVideo?.url, currentVideo?.e2ee, roomKey, blobUrl]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    window.dispatchEvent(new CustomEvent('video:controls-visibility', { detail: true }));
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
      window.dispatchEvent(new CustomEvent('video:controls-visibility', { detail: false }));
    }, 3500);
  }, []);

  // ── Keyboard Shortcut Event Listeners ──
  useEffect(() => {
    const handleTogglePlay = () => {
      if (!isHost) {
        toast.error('Only the host can control playback');
        return;
      }
      if (videoEl) {
        if (videoEl.paused) videoEl.play();
        else videoEl.pause();
      }
    };
    const handleToggleFullscreen = () => {
      const el = document.querySelector('.video-container') || videoEl;
      if (!el) return;
      if (!document.fullscreenElement) {
        el.requestFullscreen?.().catch(e => console.error(e));
      } else {
        document.exitFullscreen?.();
      }
    };
    const handleToggleMute = () => {
      if (videoEl) videoEl.muted = !videoEl.muted;
    };

    window.addEventListener('video:toggle-play', handleTogglePlay);
    window.addEventListener('video:toggle-fullscreen', handleToggleFullscreen);
    window.addEventListener('video:toggle-mute', handleToggleMute);
    return () => {
      window.removeEventListener('video:toggle-play', handleTogglePlay);
      window.removeEventListener('video:toggle-fullscreen', handleToggleFullscreen);
      window.removeEventListener('video:toggle-mute', handleToggleMute);
    };
  }, [videoEl, isHost]);

  // Initial auto-hide timer on mount
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('video:controls-visibility', { detail: true }));
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
      window.dispatchEvent(new CustomEvent('video:controls-visibility', { detail: false }));
    }, 3500);
    return () => clearTimeout(controlsTimer.current);
  }, []);

  // ── File stream handler ────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create blob URL → host starts watching IMMEDIATELY
    const localUrl = URL.createObjectURL(file);
    blobUrlRef.current = localUrl;
    setBlobUrl(localUrl);

    // Close modal instantly
    setShowSourcePicker(false);

    // DIRECT STREAMING MODE
    setIsDirectStreaming(true);
    if (room) {
      setVideoSource(
        { url: 'live-stream', type: 'live', title: `(LIVE) ${file.name}`, e2ee: !!roomKey },
        { currentTime: 0, isPlaying: false }
      );
    }
    toast.success('⚡ Live Stream Started! Participants are watching you directly.', { duration: 4000 });
  };

  // ── URL / YouTube submit ──────────────────────────────────────────────────
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;

    const resolved = resolveVideoUrl(url);

    if (!resolved) {
      toast.error('Invalid video link. Use YouTube or a direct video file (.mp4, .mkv, .webm, etc.)');
      return;
    }

    if (resolved.type === 'unsupported') {
      toast.error('Unsupported link format or platform.');
      return;
    }

    setVideoSource(
      { url: resolved.url, type: resolved.type, title: resolved.title }, 
      { isPlaying: false, currentTime: 0 }
    );
    
    setShowSourcePicker(false);
    setUrlInput('');
    toast.success(`${resolved.title} loaded!`);
  };

  // Determine what src the <video> element actually plays:
  //   - blobUrl while host is uploading (instant playback)
  //   - decryptedUrl after decryption finishes (for encrypted files)
  //   - currentVideo.url after upload completes or for direct URLs
  //   - EXCLUDES the fake 'live-stream' placeholder (prevents a broken <video> on participant side)
  const activeSrc = blobUrl || decryptedUrl || (
    currentVideo &&
    currentVideo.type !== 'youtube' &&
    currentVideo.type !== 'uploading' &&
    currentVideo.url !== 'live-stream'
      ? currentVideo.url
      : null
  );

  // Portal modal
  const sourcePicker = showSourcePicker && isHost && (
    <SourcePickerModal
      onClose={() => setShowSourcePicker(false)}
      onUrlSubmit={handleUrlSubmit}
      onFileUpload={handleFileUpload}
      urlInput={urlInput}
      setUrlInput={setUrlInput}
    />
  );


  // Regular / file / URL video / Direct Live Broadcast

  // ── Regular / file / URL video ────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full bg-black flex items-center justify-center group video-reaction-host overflow-hidden rounded-2xl border border-border-light shadow-[0_0_80px_rgba(229,9,20,0.15)] transition-all duration-500"
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      onClick={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* LIVE Badge (Visible to everyone during live streaming) */}
      {(currentVideo?.type === 'live' || isDirectStreaming) && (
        <div className="absolute top-5 left-5 z-40 flex items-center gap-2 bg-red-600/40 backdrop-blur-md px-2.5 py-1 rounded-md shadow-lg animate-fade-in border border-white/10 opacity-60">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-black text-white tracking-widest uppercase">
            Direct Live
          </span>
        </div>
      )}


      {/* Main Content Area */}
      <div className="relative z-0 w-full h-full flex items-center justify-center">
        {!isHost && currentVideo?.type === 'live' && !remotePremierStream && !isStreamAnnounced ? (
          /* Participant waiting: host has loaded a live stream but hasn't started broadcasting yet */
          <div className="flex flex-col items-center gap-3 sm:gap-5 p-4 sm:p-8 text-center animate-fade-in">
            <div className="relative w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-accent-red/10 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-accent-red/20 animate-ping" />
              <span className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-accent-red/70" />
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-bold text-text-primary mb-1">Host is Preparing to Stream</h3>
              <p className="text-text-secondary text-xs sm:text-sm">
                {currentVideo?.title?.replace(/^\(LIVE\)\s*/i, '') || 'Getting the stream ready…'}
              </p>
              <p className="text-text-muted text-[10px] sm:text-xs mt-2 sm:mt-3 flex items-center justify-center gap-1.5">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Stream will begin when host goes live
              </p>
            </div>
          </div>
        ) : !isHost && (remotePremierStream || isStreamAnnounced) ? (
          /* Participant: Show Direct/Premier Feed — only visible once host presses play */
          remotePremierStream ? (
            <div className="relative w-full h-full">
              <video 
                autoPlay 
                playsInline 
                className="w-full h-full object-contain"
                ref={setVideoRef}
                onCanPlay={() => setIsLoading(false)}
              />
            </div>
          ) : (
            /* Waiting UI inside the player — stream announced but WebRTC not connected yet */
            <div className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-8 text-center animate-pulse">
              <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-accent-purple/10 flex items-center justify-center text-accent-purple">
                <Loader2 className="w-6 h-6 sm:w-9 sm:h-9 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm sm:text-lg font-bold text-text-primary mb-1">Connecting to Feed…</h3>
                <p className="text-text-secondary text-xs sm:text-sm font-medium">{currentVideo?.title || 'Waiting for host…'}</p>
                <div className="flex items-center justify-center gap-2 mt-2 sm:mt-3 mb-1 sm:mb-2">
                  <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-500">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase">Live Link Active</span>
                  </div>
                </div>
                <p className="text-text-muted text-[10px] sm:text-xs flex items-center justify-center gap-1.5">
                   <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Broadcast starting soon
                </p>
              </div>
            </div>
          )
        ) : currentVideo?.type === 'youtube' ? (
          /* YouTube Video Proxy Output */
          <div className="relative w-full h-full">
            <YouTubePlayer 
              key={currentVideo.url}
              videoId={currentVideo.url} 
              onReady={handlePlayerReady} 
            />
          </div>
        ) : currentVideo?.type === 'hls' ? (
          /* HLS Streaming Video Output */
          <div className="relative w-full h-full">
            <HLSPlayer 
              key={currentVideo.url}
              src={currentVideo.url}
              autoPlay={isHost}
              onCanPlay={() => setIsLoading(false)}
              onReady={handlePlayerReady} 
            />
          </div>
        ) : activeSrc ? (
          /* Normal Playback (Host, or Guest with file sync) - MP4/WebM/Decrypted */
          <div className="relative w-full h-full">
            <DirectVideoPlayer
              key={activeSrc}
              src={activeSrc}
              autoPlay={isHost && !!blobUrl && currentVideo?.type !== 'live'}
              onCanPlay={() => setIsLoading(false)}
              onReady={handlePlayerReady}
            />
            {/* Start Streaming Overlay for Host */}
            {isHost && (currentVideo?.type === 'live' || isDirectStreaming) && !isLiveStreamingInitialized && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                <div className="flex flex-col items-center max-w-sm text-center animate-fade-in fade-in-up">
                  <div className="w-20 h-20 rounded-full bg-accent-red/20 flex items-center justify-center mb-6">
                    <span className="w-8 h-8 rounded-full bg-accent-red animate-pulse shadow-[0_0_30px_rgba(255,51,102,0.6)]" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Ready to Go Live</h3>
                  <p className="text-gray-300 text-sm mb-8 px-4">
                    Your video is loaded locally. Click below when you're ready to start broadcasting to all participants.
                  </p>
                  <button
                    onClick={() => {
                      setIsLiveStreamingInitialized(true);
                      if (videoEl) videoEl.play().catch(() => {});
                    }}
                    className="flexItems-center justify-center gap-2 bg-accent-red hover:bg-accent-red/90 text-white font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(255,51,102,0.4)] transition-all hover:scale-105"
                  >
                    ▶ Start Streaming
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : (
          /* Landing / Empty State */
          <div className="relative z-40 flex flex-col items-center justify-center gap-3 sm:gap-6 p-4 sm:p-8 text-center h-full overflow-y-auto">
            <div className="flex flex-col items-center max-w-md w-full gap-3 sm:gap-6">
              <div className="hidden sm:flex w-24 h-24 rounded-full bg-bg-hover items-center justify-center animate-pulse-glow shrink-0">
                <Play className="w-10 h-10 text-accent-red ml-1" />
              </div>
              <div>
                <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">No Video Loaded</h3>
                <p className="text-gray-300 text-xs sm:text-sm font-medium">
                  {isHost
                    ? 'Load a video directly, or use the extension to watch streaming platforms together.'
                    : 'Waiting for host to load a video.'}
                </p>
              </div>
              {isHost && (
                <button className="btn-primary mt-1 sm:mt-3 text-sm" onClick={() => setShowSourcePicker(true)}>
                  <Upload className="w-4 h-4" /> Load Video File / URL
                </button>
              )}
            </div>
            
            {/* Buffering Indicator Overlay (Host and Guests both see this if anyone buffers) */}
            {bufferingUsers.length > 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-bg-panel/90 backdrop-blur border border-white/10 px-4 py-2 rounded-full flex items-center gap-3 animate-fade-in pointer-events-none">
                <Loader2 className="w-4 h-4 text-accent-red animate-spin" />
                <span className="text-sm font-medium text-text-primary">
                  Waiting for {bufferingUsers.length === 1 ? bufferingUsers[0].username : `${bufferingUsers.length} users`} to buffer...
                </span>
              </div>
            )}

            {/* Custom Controls Layer */}
          </div>
        )}
      </div>


      {/* Buffering/Loading Indicator */}
      {(isLoading || isDecrypting) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none z-10 gap-3">
          <Loader2 className="w-12 h-12 text-accent-red animate-spin" />
        </div>
      )}

      {/* Controls Overlay - only render if a video is active/loaded */}
      {(activeSrc || currentVideo?.type === 'youtube' || currentVideo?.type === 'hls' || isDirectStreaming || remotePremierStream) && (
        <>
          {/* Reactions & Presence (floaters are always visible, menus follow showControls) */}
          <VideoPresenceOverlay visible={showControls} />
          <ReactionBurst />
          <QuickReactionBar visible={showControls} />

          {/* Sync Status Badge (Phase 5) */}
          {!isHost && currentVideo && currentVideo.type !== 'live' && (
            <div className="absolute top-4 right-4 z-40 pointer-events-none">
              <SyncStatusBadge status={syncStatus} />
            </div>
          )}

          {/* Fading Controls Group */}
          <div className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <VideoControls
              videoRef={videoRef}
              videoEl={videoEl}
              currentTime={currentTime}
              duration={duration}
              isHost={isHost}
              visible={showControls}
              onLoadClick={() => setShowSourcePicker(true)}
            />
          </div>
        </>
      )}

      {sourcePicker}
    </div>
  );
};

export default VideoPlayer;
