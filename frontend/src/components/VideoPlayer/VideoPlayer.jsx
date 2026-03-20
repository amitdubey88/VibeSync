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
import SubtitleOverlay from './SubtitleOverlay';
import SpeedVotePanel from './SpeedVotePanel';
import { Play, Pause, Upload, Loader2, X, Clock, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import useWebRTC from '../../hooks/useWebRTC';
import useHostTransferSync from '../../hooks/useHostTransferSync';
import { decryptFile } from '../../utils/crypto';
import { resolveVideoUrl } from '../../utils/videoResolver';

// ── Full-screen portal modal ─────────────────────────────────────────────────
const SourcePickerModal = ({ onClose, onUrlSubmit, onFileUpload, urlInput, setUrlInput, urlValidationResult }) =>
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

        {/* URL input with live validation feedback */}
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
          {/* Live type indicator */}
          {urlInput.trim() && urlValidationResult && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
              urlValidationResult.type === 'unsupported'
                ? 'text-orange-400'
                : urlValidationResult.type === 'youtube'
                  ? 'text-accent-red'
                  : urlValidationResult.type === 'hls'
                    ? 'text-blue-400'
                    : 'text-green-400'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
              {urlValidationResult.type === 'youtube' && '▶ YouTube Video'}
              {urlValidationResult.type === 'direct' && '📁 Direct Video'}
              {urlValidationResult.type === 'hls' && '📡 HLS Stream'}
              {urlValidationResult.type === 'unsupported' && '⚠ Unsupported link'}
            </div>
          )}
          {urlInput.trim() && !urlValidationResult && (
            <p className="mt-2 text-xs text-orange-400">⚠ Invalid or unrecognized URL</p>
          )}
        </form>

        <button className="btn-ghost w-full mt-4 text-sm" onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body
  );

// ── Main VideoPlayer ─────────────────────────────────────────────────────────
const VideoPlayer = () => {
  const { currentVideo, videoState, room, isHost, setVideoSource, syncDuration, isLiveStreamingInitialized, setIsLiveStreamingInitialized } = useRoom();
  const { setPremierStream, remotePremierStream, isStreamAnnounced, watchdogVideoRef } = useWebRTC();
  const { hostChangedFlag } = useHostTransferSync();
  const videoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Host-only blob URL — lets host play instantly from local file while uploading
  const [blobUrl, setBlobUrl] = useState(null);
  const blobUrlRef = useRef(null);

  // Decrypted video blob URL
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const decryptedUrlRef = useRef(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isDirectStreaming, setIsDirectStreaming] = useState(false);
  const [isPendingNextStream, setIsPendingNextStream] = useState(false);
  // Ref mirrors the state above so onPlayingEv always reads the latest value without a
  // stale closure — critical because play() fires 'playing' before React commits the state.
  const isLiveStreamingInitializedRef = useRef(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoEl, setVideoEl] = useState(null);
  const controlsTimer = useRef(null);

  // Participant stream swapping state
  const [isSwappingStream, setIsSwappingStream] = useState(false);
  const previousStreamTitleRef = useRef(null);

  // Live URL validation result — drives inline type feedback in the source picker modal
  const urlValidationResult = urlInput.trim() ? resolveVideoUrl(urlInput.trim()) : null;

  // Determine what src the <video> element actually plays:
  //   - blobUrl while host is uploading (instant playback)
  //   - decryptedUrl after decryption finishes (for encrypted files)
  //   - currentVideo.url for direct or hls-fallback types
  //   - EXCLUDES youtube (handled by YouTubePlayer), uploading, and 'live-stream' placeholder
  const activeSrc = blobUrl || decryptedUrl || (
    currentVideo &&
    currentVideo.type !== 'youtube' &&
    currentVideo.type !== 'hls' &&
    currentVideo.type !== 'uploading' &&
    currentVideo.url !== 'live-stream'
      ? currentVideo.url
      : null
  );

  // Derived visibility states (State-driven UI)
  const isWebRTCStream = currentVideo?.type === 'live' || isDirectStreaming;
  const isStreamActive = isLiveStreamingInitialized || (!isHost && remotePremierStream);
  
  const shouldShowControls = (!isWebRTCStream || isStreamActive) && (
    activeSrc || 
    (currentVideo?.type === 'youtube' && videoEl !== null) || 
    currentVideo?.type === 'hls' || 
    isDirectStreaming || 
    remotePremierStream
  );

  // Live ref so the callback can read playback position without stale closure
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  // Guards against re-capturing the stream on 'playing' events fired after seeking.
  // Once captureStream is active, seeking triggers 'playing' again — without this guard,
  // setPremierStream would tear down all participant connections on every seek.
  const isStreamingActiveRef = useRef(false);

  // Ref mirror for remotePremierStream so video-element event listeners (onWaiting, etc.)
  // can read the latest value without stale closures — avoids adding remotePremierStream
  // to the event-listener effect's dep array (which would re-register listeners on every track).
  const remotePremierStreamRef = useRef(remotePremierStream);
  useEffect(() => { remotePremierStreamRef.current = remotePremierStream; }, [remotePremierStream]);

  // Keep isLiveStreamingInitializedRef in sync with state to prevent drift.
  // The ref is needed for the 'playing' event handler (fires before React commit),
  // but the state drives UI. Both must always agree.
  useEffect(() => {
    isLiveStreamingInitializedRef.current = isLiveStreamingInitialized;
  }, [isLiveStreamingInitialized]);

  useEffect(() => {
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    const resizeHandler = () => setIsMobile(window.innerWidth < 768);
    document.addEventListener('fullscreenchange', fsHandler);
    window.addEventListener('resize', resizeHandler);
    return () => {
      document.removeEventListener('fullscreenchange', fsHandler);
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  // BUG4 FIX: Stable useCallback at component scope so both the 'playing' event handler
  // and the 'Start Streaming' button always reference the latest version.
  // Previously defined inside a useEffect body which created a stale closure on video switch.
  const startBroadcast = useCallback(() => {
    if (!isHost || !videoRef.current || !videoRef.current.captureStream) return;
    if (isStreamingActiveRef.current) return;

    console.log('[DirectStream] Starting WebRTC broadcast capture...');
    isStreamingActiveRef.current = true;

    // Delay slightly to ensure the video has painted a frame before capturing
    setTimeout(() => {
      try {
        const stream = videoRef.current.captureStream(60);
        setPremierStream(stream);
        console.log('[DirectStream] Stream captured and announced to room.');
      } catch (e) {
        console.error('[DirectStream] captureStream failed:', e);
        isStreamingActiveRef.current = false;
      }
    }, 300);
  }, [isHost, setPremierStream]); // stable deps — videoRef is a ref so no dep needed

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

  // ── Auto-play/seek for participants when videoEl mounts ───────────────────
  // useVideoSync handles live video:play events, but if the participant's video
  // element was not yet mounted when the event arrived (e.g. still decrypting or
  // waiting for currentVideo state to propagate), this effect catches up as soon
  // as the element becomes available.
  //
  // BUGFIX: Previously only ran when videoState.isPlaying was true — so participants
  // joining while the host had the video paused would always start from 0:00 instead
  // of the paused position. Now we always seek to the correct server timestamp on
  // mount, regardless of play/pause state.
  useEffect(() => {
    if (!videoEl || isHost) return;
    if (!videoState) return;
    if (currentVideo?.type === 'live' || currentVideo?.type === 'uploading') return;

    // Compute adjusted target time accounting for elapsed wall-clock time since last update
    const elapsed = videoState.isPlaying && videoState.lastUpdated
      ? Math.max(0, (Date.now() - videoState.lastUpdated) / 1000)
      : 0;
    const targetTime = Math.max(0, (videoState.currentTime || 0) + elapsed);

    // Instant sync for source changes: if element exists and we have state, sync it.
    // Separately, if this is a fresh mount, the canplay listener handles it.

    const doSync = () => {
      // Always seek to the correct position
      if (targetTime > 0.5) videoEl.currentTime = targetTime;
      // Only start playing if the host was playing
      if (videoState.isPlaying) {
        videoEl.play().catch(() => {});
      }
    };

    if (videoEl.readyState >= 2) {
      doSync();
    } else {
      videoEl.addEventListener('canplay', doSync, { once: true });
      return () => videoEl.removeEventListener('canplay', doSync);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl, currentVideo?.url]); // Re-run when videoEl mounts OR when video source URL changes

  useEffect(() => {
    if (isHost || !videoEl) return;

    if (remotePremierStream) {
      console.log('[VideoPlayer] Attaching remote live stream to video element.');

      // FIX: Always pause() BEFORE clearing srcObject. Setting srcObject = null fires a
      // synchronous load() which interrupts any in-flight play() promise with:
      //   "AbortError: The play() request was interrupted by a new load request"
      // Pausing cancels the pending play first, making the srcObject swap safe.
      if (!videoEl.paused) videoEl.pause();
      videoEl.srcObject = null;
      videoEl.srcObject = remotePremierStream;

      // Register with watchdog so health checks can monitor this element's readyState
      if (watchdogVideoRef) watchdogVideoRef.current = videoEl;

      setIsLoading(false);

      // Attempt unmuted playback first; muted is the fallback if browser blocks it.
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          // 'AbortError' here means srcObject was changed again before play resolved —
          // this is normal during rapid switches, just ignore it.
          if (err.name === 'AbortError') return;
          console.warn('[Participant Live] Unmuted autoplay blocked, trying muted...', err);
          videoEl.muted = true;
          videoEl.play().catch(muteErr => {
            if (muteErr.name === 'AbortError') return;
            console.error('[Participant Live] Muted autoplay also failed:', muteErr);
          });
          setIsLoading(false);
          // NEW: Inform the user so they don't think "the sound banked out" glitchily
          toast('Audio blocked by browser. Tap speaker icon to unmute.', { icon: '🔇', duration: 4000 });
        });
      }
    } else if (videoEl.srcObject) {
      console.log('[VideoPlayer] Live stream ended. Clearing srcObject.');
      if (watchdogVideoRef) watchdogVideoRef.current = null;
      if (!videoEl.paused) videoEl.pause();
      videoEl.srcObject = null;
      videoEl.load();
    }
  }, [remotePremierStream, videoEl, isHost, watchdogVideoRef]);

  // LIVE-PAUSE-THEN-CHANGE FIX:
  // When host pauses live stream and then changes video to a new URL-based type,
  // the participant's video element may still hold a stale srcObject from the WebRTC stream.
  // This effect fires as soon as currentVideo.type changes away from live/uploading
  // and aggressively clears the srcObject so the new src can load properly.
  useEffect(() => {
    if (isHost) return;
    const isLiveType = currentVideo?.type === 'live' || currentVideo?.type === 'uploading';
    if (!isLiveType && videoEl?.srcObject) {
      console.log('[VideoPlayer] Live type ended. Force-clearing srcObject for new video source.');
      videoEl.srcObject = null;
      // Force a reload so the element picks up the new `src` attribute
      videoEl.load();
    }
  // We only care about the video type changing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.type, isHost]);

  useEffect(() => {
    if (!videoEl) return;
    const updateBuffered = () => {
      if (!videoEl || !videoEl.buffered || videoEl.buffered.length === 0) return;
      const duration = videoEl.duration;
      if (duration > 0) {
        // Find the buffer range that contains current time
        let end = 0;
        for (let i = 0; i < videoEl.buffered.length; i++) {
          if (videoEl.buffered.start(i) <= videoEl.currentTime) {
            end = Math.max(end, videoEl.buffered.end(i));
          }
        }
        setBuffered(end);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(videoEl.currentTime);
      currentTimeRef.current = videoEl.currentTime;
      updateBuffered();
    };
    const onLoadedMetadata = () => {
      setDuration(videoEl.duration);
      updateBuffered();
    };
    const onWaiting = () => {
      // Use ref to read latest remotePremierStream without stale closure
      const isLiveGuest = !isHost && (currentVideo?.type === 'live' || remotePremierStreamRef.current);
      if (videoEl.readyState < 2 && !isLiveGuest) {
        setIsLoading(true);
      }
    };
    const onCanPlay = () => setIsLoading(false);
    const onProgress = () => updateBuffered();
    const onPlayEv = () => {
      isPlayingRef.current = true;
    };

    const onPlayingEv = () => {
      // BUGFIX: Clear the loading spinner when we know frames are actually rendering.
      setIsLoading(false);

      // For uploads, start broadcast immediately on play.
      // For live streams, only broadcast if the host explicitly clicked 'Start Streaming' first.
      // NOTE: Read from ref (not state) — 'playing' fires before React commits the state update.
      const shouldBroadcast = isHost && (
        (currentVideo?.type === 'live' || isDirectStreaming) && isLiveStreamingInitializedRef.current
      );
      
      if (shouldBroadcast) {
        startBroadcast();
      }
    };
    const onPauseEv = () => {
      isPlayingRef.current = false;
      // When host pauses, do NOT stop the stream.
      // captureStream keeps sending the frozen current frame — participants
      // see the paused frame rather than the 'Connecting to Feed...' screen.
      // Stream is only fully stopped on 'ended' or source change.
    };

    // If metadata was already loaded (e.g. YouTube proxy fires it synchronously on creation),
    // grab the duration immediately before listening for future updates
    if (videoEl.readyState >= 1) {
      onLoadedMetadata();
    }

    // Safety fallback for participants in live mode:
    // If we're stuck in loading for more than 4s while a live stream is active, clear it.
    // Use ref to read latest remotePremierStream without adding it to dep array.
    let safetyTimer;
    if (!isHost && (currentVideo?.type === 'live' || remotePremierStreamRef.current)) {
      safetyTimer = setTimeout(() => {
        setIsLoading(false);
      }, 4000);
    }

    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    videoEl.addEventListener('waiting', onWaiting);
    videoEl.addEventListener('canplay', onCanPlay);
    videoEl.addEventListener('progress', onProgress);
    videoEl.addEventListener('play', onPlayEv);
    videoEl.addEventListener('playing', onPlayingEv);
    videoEl.addEventListener('pause', onPauseEv);
    videoEl.addEventListener('ended', onPauseEv);
    videoEl.addEventListener('seeking', onTimeUpdate);
    videoEl.addEventListener('seeked', onTimeUpdate);

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.removeEventListener('waiting', onWaiting);
      videoEl.removeEventListener('canplay', onCanPlay);
      videoEl.removeEventListener('progress', onProgress);
      videoEl.removeEventListener('play', onPlayEv);
      videoEl.removeEventListener('playing', onPlayingEv);
      videoEl.removeEventListener('pause', onPauseEv);
      videoEl.removeEventListener('ended', onPauseEv);
      videoEl.removeEventListener('seeking', onTimeUpdate);
      videoEl.removeEventListener('seeked', onTimeUpdate);
    };
  // startBroadcast is now a stable useCallback — no longer a closure dep here
  }, [videoEl, isHost, currentVideo?.type, isDirectStreaming, startBroadcast]);

  // ── Participant Stream Swap UX ──────────────────────────────────────────
  // Detects when the host changes the live stream file (title changes, URL stays 'live-stream')
  // and shows a loading overlay until the WebRTC tracks are fully replaced.
  useEffect(() => {
    if (isHost) return;
    
    if (!currentVideo || currentVideo.type !== 'live') {
      previousStreamTitleRef.current = null;
      setIsSwappingStream(false);
      return;
    }

    if (!previousStreamTitleRef.current) {
      previousStreamTitleRef.current = currentVideo.title;
      return;
    }

    if (currentVideo.title !== previousStreamTitleRef.current) {
      console.log('[VideoPlayer] Stream title changed — showing participant loading overlay');
      setIsSwappingStream(true);
      previousStreamTitleRef.current = currentVideo.title;
      
      // Fallback to clear loading state just in case event drops
      const t = setTimeout(() => setIsSwappingStream(false), 5000);
      return () => clearTimeout(t);
    }
  }, [currentVideo, isHost]);

  useEffect(() => {
    if (isHost) return;
    const handleSwapComplete = () => {
      console.log('[VideoPlayer] Tracks replaced event received — hiding loading overlay');
      setIsSwappingStream(false);
    };
    window.addEventListener('video-stream:tracks-replaced', handleSwapComplete);
    return () => window.removeEventListener('video-stream:tracks-replaced', handleSwapComplete);
  }, [isHost]);

  // Detect video source change and reset streaming-active flag for re-capture.
  // CRITICAL: Do NOT reset isLiveStreamingInitialized if streaming was already active.
  // Resetting it shows the "Ready to Go Live" overlay and blocks auto-rebroadcast.
  // Instead, keep it true so onPlayingEv → startBroadcast() fires automatically.
  // startBroadcast() will captureStream() the new video and setPremierStream() will
  // use replaceTrack() on existing PCs — seamless switch, zero interruption.
  useEffect(() => {
    if (!isHost) return;
    
    const isSourceChanged = !currentVideo?.url || 
                           (currentVideo.url !== 'live-stream' && currentVideo.url !== blobUrlRef.current) ||
                           (currentVideo.url === 'live-stream' && blobUrl && blobUrl !== blobUrlRef.current);

    if (isSourceChanged) {
      // Check BEFORE resetting: was streaming previously active?
      const wasStreaming = isStreamingActiveRef.current || isLiveStreamingInitializedRef.current;
      console.log(`[VideoPlayer] Video source changed. wasStreaming=${!!wasStreaming}`);
      
      // Always reset streaming-active so the next startBroadcast() re-captures
      isStreamingActiveRef.current = false;
      
      const isLiveType = currentVideo?.type === 'live' || currentVideo?.type === 'uploading';

      if (!currentVideo?.url || !isLiveType) {
        // No video source, OR switching to a non-live source — fully stop streaming
        if (wasStreaming) console.log('[VideoPlayer] Closing WebRTC broadcast due to switching away from live mode');
        setPremierStream(null);
        setIsLiveStreamingInitialized(false);
        isLiveStreamingInitializedRef.current = false;
      } else if (wasStreaming) {
        // Video source changed but streaming was active AND the NEW type is live
        // keep initialized so onPlayingEv → startBroadcast() fires automatically.
        console.log('[VideoPlayer] Keeping streaming initialized for seamless video switch');
      } else {
        // Source changed but streaming was never started — reset to show overlay
        setIsLiveStreamingInitialized(false);
        isLiveStreamingInitializedRef.current = false;
      }
    }
  }, [currentVideo, isHost, setPremierStream, blobUrl]);

  // The previous BLACK SCREEN FIX logic has been merged into the isSourceChanged hook above.
  // We keep this empty or remove it. We'll simply omit it.

  // Reset local timing when video source changes
  useEffect(() => {
    if (currentVideo?.url) {
      console.log('[VideoPlayer] Source changed, resetting local timing states.');
      setDuration(0);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      setBuffered(0);
    }
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
  }, [isHost, duration, currentVideo, videoState, syncDuration]);

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
    // Only fetch/decrypt if it's an encrypted non-live file and we aren't the host with a blobUrl.
    // Guard against: live streams (type=live or url=live-stream), youtube, host-side blob uploads.
    if (
      !currentVideo ||
      currentVideo.type === 'youtube' ||
      currentVideo.type === 'live' ||
      currentVideo.url === 'live-stream' ||
      !currentVideo.e2ee ||
      blobUrl ||
      !roomKey
    ) {
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
        console.error('Decryption failed:', err, '| url:', currentVideo?.url, '| type:', currentVideo?.type);
        // toast.error('Failed to decrypt video');
      } finally {
        if (active) setIsDecrypting(false);
      }
    };

    fetchAndDecrypt();
    return () => { active = false; };
  }, [currentVideo, roomKey, blobUrl]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    window.dispatchEvent(new CustomEvent('video:controls-visibility', { detail: true }));
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
      window.dispatchEvent(new CustomEvent('video:controls-visibility', { detail: false }));
    }, 3500);
  }, []);

  // Center-click to play/pause (host only, all video types)
  const clickAnimRef = useRef(null);
  const [clickAnim, setClickAnim] = useState(null); // 'play' | 'pause' | null

  const handleCenterClick = useCallback(() => {
    handleMouseMove();

    console.log('CLICK', {
      isHost,
      isWebRTCStream,
      isLiveStreamingInitialized,
      hasVideo: !!videoEl,
      activeSrc
    });

    if (!videoEl) return;

    // Only host controls playback
    if (!isHost) return;
    
    // Only block during strict pre-live state (host hasn't started stream yet)
    if (
      isHost &&
      isWebRTCStream &&
      !isLiveStreamingInitialized &&
      !activeSrc
    ) {
      return;
    }
    
    const isPaused = videoEl.paused;
    if (isPaused) {
      videoEl.play().catch(() => {});
    } else {
      videoEl.pause();
    }
    
    setClickAnim(isPaused ? 'play' : 'pause');
    clearTimeout(clickAnimRef.current);
    clickAnimRef.current = setTimeout(() => setClickAnim(null), 600);
  }, [videoEl, isHost, handleMouseMove, isWebRTCStream, isLiveStreamingInitialized, activeSrc]);

  // ── Keyboard Shortcut Event Listeners ──
  useEffect(() => {
    const handleTogglePlay = () => {
      if (!isHost) {
        toast.error('Only the host can control playback');
        return;
      }
      if (videoEl) {
        if (videoEl.paused) videoEl.play().catch(() => {});
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

    // Check BEFORE updating refs: was a live stream already active?
    // If so, we need to reset isStreamingActiveRef so startBroadcast() can
    // re-capture from the new video. Without this, captureStream() never fires
    // because the guard `if (isStreamingActiveRef.current) return` blocks it.
    const wasAlreadyStreaming = isStreamingActiveRef.current;

    if (blobUrlRef.current) {
       URL.revokeObjectURL(blobUrlRef.current);
    }

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

    if (wasAlreadyStreaming) {
      console.log('[VideoPlayer] Switching live file — pausing for host to start next stream');
      isStreamingActiveRef.current = false;
      setIsLiveStreamingInitialized(false);
      isLiveStreamingInitializedRef.current = false;
      setIsPendingNextStream(true);
      toast.success('⚡ Video Loaded! Click "Stream Next Video" to go live.', { duration: 4000 });
    } else {
      toast.success('⚡ Video Loaded! Click "Start Streaming" to go live.', { duration: 4000 });
    }
  };

  // ── URL / YouTube submit ──────────────────────────────────────────────────
  const handleUrlSubmit = async (e) => {
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

    if (resolved.type === 'direct') {
      const validateToast = toast.loading('Checking video link...');
      try {
        await new Promise((resolve, reject) => {
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.onloadedmetadata = () => resolve(true);
          vid.onerror = () => reject(new Error('Not a playable video'));
          setTimeout(() => reject(new Error('Timeout checking video')), 10000);
          vid.src = resolved.url;
        });
        toast.dismiss(validateToast);
      } catch {
        toast.dismiss(validateToast);
        toast.error('The link does not contain a valid or playable video.');
        return; // Reject the link, don't broadcast to room
      }
    }

    // Explicitly clean up any previous blob/streaming state since we are moving to a URL
    if (blobUrlRef.current) {
       URL.revokeObjectURL(blobUrlRef.current);
       blobUrlRef.current = null;
    }
    setBlobUrl(null);
    setIsDirectStreaming(false);
    setIsLiveStreamingInitialized(false);
    isLiveStreamingInitializedRef.current = false;
    isStreamingActiveRef.current = false;
    setPremierStream(null);

    setVideoSource(
      { url: resolved.url, type: resolved.type, title: resolved.title }, 
      { isPlaying: false, currentTime: 0 }
    );
    
    setShowSourcePicker(false);
    setUrlInput('');
    toast.success(`${resolved.title} loaded!`);
  };


  // Portal modal
  const sourcePicker = showSourcePicker && isHost && (
    <SourcePickerModal
      onClose={() => setShowSourcePicker(false)}
      onUrlSubmit={handleUrlSubmit}
      onFileUpload={handleFileUpload}
      urlInput={urlInput}
      setUrlInput={setUrlInput}
      urlValidationResult={urlValidationResult}
    />
  );


  // Regular / file / URL video / Direct Live Broadcast

  // ── Regular / file / URL video ────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full bg-black flex items-center justify-center group video-reaction-host video-container overflow-hidden rounded-2xl border border-border-light shadow-[0_0_80px_rgba(229,9,20,0.15)] transition-all duration-500"
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      onClick={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      // Intercept the F key on the container level to prevent the browser's native fullscreen
      onKeyDown={(e) => { if (e.key === 'f' || e.key === 'F') e.preventDefault(); }}
      tabIndex={-1}
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
        {/* Center-click overlay: transparent layer that intercepts clicks for play/pause */}
        {/* Positioned above video content but below controls. Renders for all video types. */}
        <div
          className="absolute inset-0 z-10 cursor-pointer pointer-events-auto flex items-center justify-center group/centerclick"
          onClick={handleCenterClick}
          style={{ touchAction: 'manipulation' }}
        >
          {shouldShowControls && !isLoading && videoState && !videoState.isPlaying && currentVideo?.type !== 'live' && (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-xl transition-all duration-300 transform group-hover/centerclick:scale-105 animate-fade-in">
              <Play className="w-10 h-10 sm:w-12 sm:h-12 text-white ml-2 md:opacity-80 md:group-hover/centerclick:opacity-100" />
            </div>
          )}
        </div>

        {/* Click animation flash (Play/Pause ripple) */}
        {clickAnim && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center animate-ping-once">
              {clickAnim === 'play'
                ? <Play className="w-7 h-7 text-white" />
                : <Pause className="w-7 h-7 text-white" />}
            </div>
          </div>
        )}

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
                key={remotePremierStream?.id || 'live-video'}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                ref={(el) => {
                  setVideoRef(el);
                  // BUG5+6 FIX: Register this element with the watchdog immediately on mount.
                  // This ensures the health check starts monitoring as soon as the element exists.
                  if (watchdogVideoRef) watchdogVideoRef.current = el;
                }}
                onCanPlay={() => setIsLoading(false)}
                onPlaying={() => setIsLoading(false)}
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
          <div className="absolute inset-0 z-0">
            <YouTubePlayer 
              key={currentVideo.url}
              videoId={currentVideo.url} 
              onReady={handlePlayerReady}
              onError={() => setIsLoading(false)}
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
            {isHost && isWebRTCStream && !isLiveStreamingInitialized && (
              <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl pointer-events-auto">
                <div className="flex flex-col items-center max-w-[90%] sm:max-w-sm text-center animate-fade-in fade-in-up">
                  <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-accent-red/20 flex items-center justify-center mb-4 sm:mb-6">
                    <span className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-accent-red animate-pulse shadow-[0_0_30px_rgba(255,51,102,0.6)]" />
                  </div>
                  <h3 className="text-lg sm:text-2xl font-bold text-white mb-2">
                    {isPendingNextStream ? 'Ready to Stream Next Video' : 'Ready to Go Live'}
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm mb-6 sm:mb-8 px-2 sm:px-4">
                    Your video is loaded locally. Click below when you're ready to start broadcasting to all participants.
                  </p>
                   <button
                    disabled={!videoRef.current && !videoEl}
                    onClick={() => {
                      console.log('[DirectStream] User clicked Start Streaming.');
                      isLiveStreamingInitializedRef.current = true;
                      setIsLiveStreamingInitialized(true);
                      setIsPendingNextStream(false);

                      const el = videoRef.current || videoEl;
                      if (!el) {
                         console.error('[DirectStream] Cannot start: video element missing.');
                         return;
                      }

                      // BUG4 FIX: startBroadcast is now a stable useCallback — no stale closure.
                      if (!el.paused) {
                        startBroadcast();
                      } else {
                        el.play().catch(err => console.error('[DirectStream] Play after init failed:', err));
                      }
                    }}
                    className={`flex items-center justify-center gap-2 font-bold py-2 sm:py-3 px-6 sm:px-8 text-sm sm:text-base rounded-full shadow-[0_0_20px_rgba(255,51,102,0.4)] transition-all ${
                       (!videoRef.current && !videoEl) ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-accent-red hover:bg-accent-red/90 text-white hover:scale-105'
                    }`}
                  >
                    ▶ {isPendingNextStream ? 'Stream Next Video' : 'Start Streaming'}
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
      {(isLoading || isDecrypting || isSwappingStream) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none z-50 gap-3">
          <Loader2 className="w-12 h-12 text-accent-red animate-spin" />
          {isSwappingStream && (
            <div className="text-center animate-fade-in">
              <p className="text-white font-bold text-lg">Loading Next Stream...</p>
              <p className="text-gray-300 text-sm">The host is switching videos</p>
            </div>
          )}
        </div>
      )}

      {/* Feature 11: Subtitles Overlay (always visible if active) */}
      <SubtitleOverlay />
      <SpeedVotePanel />

      {/* Controls Overlay - only render if derived state allows it */}
      {shouldShowControls && (
        <>
          {/* Reactions & Presence (floaters are always visible) */}
          <VideoPresenceOverlay visible={showControls} />
          <div className="pointer-events-none">
            <ReactionBurst />
          </div>

          {/* Quick Reaction Bar (Desktop or Fullscreen only here) */}
          {(isFullscreen || !isMobile) && (
            <QuickReactionBar visible={showControls} isOverlay={true} />
          )}

          {/* Sync Status Badge */}
          {!isHost && currentVideo && currentVideo.type !== 'live' && (
            <div className="absolute top-4 right-4 z-40 pointer-events-none">
              <SyncStatusBadge status={syncStatus} />
            </div>
          )}

          {/* Fading Controls Group */}
          <div className={`absolute inset-0 z-30 transition-opacity duration-300 pointer-events-none
            ${showControls ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* The wrapper itself should be pointer-events-none, but VideoControls inside will have pointer-events-auto when visible */}
            <VideoControls
              videoRef={videoRef}
              videoEl={videoEl}
              currentTime={currentTime}
              duration={duration}
              buffered={buffered}
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
