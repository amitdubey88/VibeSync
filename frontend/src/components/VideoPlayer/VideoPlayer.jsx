import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoom } from '../../context/RoomContext';
import { useSocket } from '../../context/SocketContext';
import useVideoSync from '../../hooks/useVideoSync';
import VideoControls from './VideoControls';
import VideoReactionBar from './VideoReactionBar';
import YouTubePlayer from './YouTubePlayer';
import { Play, Upload, Loader2, X, Film, CloudUpload, Clock, Puzzle } from 'lucide-react';
import { uploadVideo } from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import useWebRTC from '../../hooks/useWebRTC';

// ── Full-screen portal modal ─────────────────────────────────────────────────
const SourcePickerModal = ({ onClose, onUrlSubmit, onFileUpload, urlInput, setUrlInput, isUploading, uploadProgress }) =>
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
        <div className="mb-5">
          <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            Upload File (MP4, WebM)
          </label>
          <label className={`flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all
            ${isUploading ? 'border-accent-purple bg-accent-purple/5 pointer-events-none' : 'border-border-light hover:border-accent-purple/60 hover:bg-accent-purple/5'}`}>
            <input type="file" accept="video/*" className="hidden" onChange={onFileUpload} disabled={isUploading} />
            {isUploading ? (
              <div className="text-center w-full">
                <CloudUpload className="w-6 h-6 animate-pulse text-accent-purple mx-auto mb-2" />
                <span className="text-sm text-accent-purple font-semibold">Uploading for guests… {uploadProgress}%</span>
                <div className="mt-2 h-1.5 bg-bg-hover rounded-full overflow-hidden w-full mx-auto">
                  <div className="h-full bg-accent-purple transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-text-muted mt-1.5">You can watch now — guests will sync when ready</p>
              </div>
            ) : (
              <div className="text-center">
                <Film className="w-6 h-6 text-text-muted mx-auto mb-1.5" />
                <span className="text-sm text-text-secondary font-medium">Click to select video</span>
                <p className="text-xs text-text-muted mt-0.5">Plays instantly for you, syncs to guests in background</p>
              </div>
            )}
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
  const { currentVideo, room, isHost, setVideoSource, notifyUploading, participants } = useRoom();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { remoteScreens } = useWebRTC();
  const videoRef = useRef(null);

  const canShareScreen = participants.find(p => p.userId === user?.id)?.canShareScreen || false;
  const hasActiveScreenShare = Object.keys(remoteScreens || {}).length > 0;

  // Host-only blob URL — lets host play instantly from local file while uploading
  const [blobUrl, setBlobUrl] = useState(null);
  const blobUrlRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoEl, setVideoEl] = useState(null);
  const controlsTimer = useRef(null);

  // Live ref so the upload callback can read playback position without stale closure
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);

  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    setVideoEl(el);
  }, []);

  useVideoSync(videoEl);

  // Keep live refs updated
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  useEffect(() => {
    if (!videoEl) return;
    const onTimeUpdate = () => {
      setCurrentTime(videoEl.currentTime);
      currentTimeRef.current = videoEl.currentTime;
    };
    const onLoadedMetadata = () => setDuration(videoEl.duration);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlayEv = () => { isPlayingRef.current = true; };
    const onPauseEv = () => { isPlayingRef.current = false; };
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    videoEl.addEventListener('waiting', onWaiting);
    videoEl.addEventListener('canplay', onCanPlay);
    videoEl.addEventListener('play', onPlayEv);
    videoEl.addEventListener('pause', onPauseEv);
    return () => {
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.removeEventListener('waiting', onWaiting);
      videoEl.removeEventListener('canplay', onCanPlay);
      videoEl.removeEventListener('play', onPlayEv);
      videoEl.removeEventListener('pause', onPauseEv);
    };
  }, [videoEl]);

  // Cleanup blob URL on unmount
  useEffect(() => () => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
  }, []);

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

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  // ── File upload: INSTANT local play + background upload ────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Create blob URL → host starts watching IMMEDIATELY
    const localUrl = URL.createObjectURL(file);
    blobUrlRef.current = localUrl;
    setBlobUrl(localUrl);

    // Close modal instantly so the host can actually see the video!
    setShowSourcePicker(false);

    // 2. Tell participants host started uploading (they see buffering state, not blank)
    if (room) notifyUploading(file.name);
    toast.success('▶ Playing now! Uploading for guests to sync…', { duration: 4000 });

    // 3. Upload to Cloudinary in background
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const data = await uploadVideo(file, setUploadProgress);

      // 4. Capture current playback position BEFORE swapping src
      const ct = currentTimeRef.current;
      const wasPlaying = isPlayingRef.current;

      // 5. Schedule a seek once the video element loads the new Cloudinary src
      pendingSeekRef.current = { targetTime: ct, shouldPlay: wasPlaying };

      // 6. Broadcast final URL to all participants with current position
      setVideoSource(
        { url: data.url, type: 'file', title: file.name },
        { currentTime: ct, isPlaying: wasPlaying, preserveState: true }
      );

      // 7. Swap host from blob → Cloudinary (triggers re-render → video src changes → pendingSeek fires)
      URL.revokeObjectURL(localUrl);
      blobUrlRef.current = null;
      setBlobUrl(null);

      toast.success('☁ Uploaded! Guests are now syncing.', { duration: 3000 });
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
      // Host keeps watching from blob — they can retry later
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // ── URL / YouTube submit ──────────────────────────────────────────────────
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      setVideoSource({ url: ytMatch[1], type: 'youtube', title: 'YouTube Video' });
    } else {
      setVideoSource({ url, type: 'url', title: url.split('/').pop() || 'Video' });
    }
    setShowSourcePicker(false);
    setUrlInput('');
    toast.success('Video source set!');
  };

  // Determine what src the <video> element actually plays:
  //   - blobUrl while host is uploading (instant playback)
  //   - currentVideo.url after upload completes or for direct URLs
  const activeSrc = blobUrl || (
    currentVideo && currentVideo.type !== 'youtube' && currentVideo.type !== 'uploading'
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
      isUploading={isUploading}
      uploadProgress={uploadProgress}
    />
  );

  // ── Participant waiting state during host upload ──────────────────────────
  if (!isHost && currentVideo?.type === 'uploading') {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-accent-purple/10 flex items-center justify-center animate-pulse">
            <CloudUpload className="w-9 h-9 text-accent-purple" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">Video loading…</h3>
            <p className="text-text-muted text-xs mt-2 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Starting shortly, please wait
            </p>
          </div>
          <div className="flex gap-1.5 mt-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full bg-accent-purple/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
        {sourcePicker}
      </div>
    );
  }

  // ── YouTube player ────────────────────────────────────────────────────────
  if (currentVideo?.type === 'youtube') {
    return (
      <div className="relative w-full h-full bg-black">
        <YouTubePlayer videoId={currentVideo.url} />
        {/* Transparent overlay blocks non-host clicks */}
        {!isHost && (
          <div className="absolute inset-0 z-10 cursor-not-allowed" title="Only the host can control playback" />
        )}
        {isHost && (
          <button
            onClick={() => setShowSourcePicker(true)}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/60 hover:bg-black/80
                       border border-white/20 hover:border-white/40 text-white text-xs font-semibold
                       px-3 py-1.5 rounded-lg backdrop-blur-sm transition-all duration-200"
          >
            <Upload className="w-3.5 h-3.5" /> Change Video
          </button>
        )}
        {sourcePicker}
      </div>
    );
  }

  // ── Participant waiting state (host is uploading) ─────────────────────────
  if (!isHost && currentVideo?.type === 'uploading') {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-accent-purple/10 flex items-center justify-center animate-pulse">
            <CloudUpload className="w-9 h-9 text-accent-purple" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">Host is uploading a video</h3>
            <p className="text-text-secondary text-sm font-medium">{currentVideo.title || 'Video'}</p>
            <p className="text-text-muted text-xs mt-2 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> You'll sync automatically when it's ready
            </p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full bg-accent-purple/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Regular / file / URL video ────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full bg-black flex items-center justify-center group video-reaction-host overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      onClick={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Background upload progress bar — thin strip at top (host only) */}
      {isHost && isUploading && (
        <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-bg-hover">
          <div
            className="h-full bg-gradient-to-r from-accent-purple to-accent-red transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {activeSrc ? (
        <video
          ref={setVideoRef}
          key={activeSrc}   /* Force remount when src changes so events reattach cleanly */
          className="w-full h-full object-contain"
          src={activeSrc}
          playsInline
          preload="auto"
        />
      ) : (
        !hasActiveScreenShare && (
          <div className="flex flex-col items-center justify-center gap-6 p-8 text-center h-full overflow-y-auto">
            <div className="flex flex-col items-center max-w-md w-full gap-6">
              
              <div className="hidden sm:flex w-24 h-24 rounded-full bg-bg-hover items-center justify-center animate-pulse-glow shrink-0">
                <Play className="w-10 h-10 text-accent-red ml-1" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">No Video Loaded</h3>
                <p className="text-gray-300 text-sm font-medium">
                  {isHost ? 'Load a video directly, or use the extension to watch streaming platforms together.' : 'Waiting for host to load a video, or start a streaming party.'}
                </p>
              </div>

              {isHost && (
                <button className="btn-primary mt-3" onClick={() => setShowSourcePicker(true)}>
                  <Upload className="w-4 h-4" /> Load Video File / URL
                </button>
              )}

              <div className="hidden sm:block w-full mt-4 bg-bg-hover/50 rounded-2xl p-6 border border-border-light text-left relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-accent-purple/10 rounded-full blur-2xl group-hover:bg-accent-purple/20 transition-colors" />
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-accent-purple/20 rounded-lg">
                    <Puzzle className="w-5 h-5 text-accent-purple" />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary text-base">Watch Netflix, Prime & more</h4>
                    <p className="text-xs text-text-muted mt-0.5">Sync playback across premium streaming platforms</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  {['Netflix', 'Prime', 'Hotstar', 'JioCinema', 'Disney+', 'Max', 'MX Player', 'MiniTV'].map(p => (
                    <span key={p} className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-md bg-bg-primary/50 text-text-muted border border-border-dark">{p}</span>
                  ))}
                </div>

                <a 
                  href="https://github.com/amitdubey88/VibeSync/tree/main/extension" 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-secondary w-full justify-center text-sm py-2.5"
                >
                  Install Browser Extension
                </a>
              </div>

            </div>
          </div>
        )
      )}

      {/* Buffering spinner */}
      {isLoading && activeSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-12 h-12 text-accent-red animate-spin" />
        </div>
      )}

      {/* Controls overlay (host only — guests have controls disabled in VideoControls) */}
      {activeSrc && (
        <div className={`absolute inset-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <VideoControls
            videoRef={videoRef}
            currentTime={currentTime}
            duration={duration}
            isHost={isHost}
            onLoadClick={isHost ? () => setShowSourcePicker(true) : undefined}
          />
        </div>
      )}

      {/* Teams-style floating reaction bar — animations visible everywhere, bar hidden on mobile */}
      {activeSrc && (
        <VideoReactionBar />
      )}

      {sourcePicker}
    </div>
  );
};

export default VideoPlayer;
