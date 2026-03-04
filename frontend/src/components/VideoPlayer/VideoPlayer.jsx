import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRoom } from '../../context/RoomContext';
import useVideoSync from '../../hooks/useVideoSync';
import VideoControls from './VideoControls';
import YouTubePlayer from './YouTubePlayer';
import { Play, Upload, Link, Loader2, X, Film, CloudUpload, Clock } from 'lucide-react';
import { uploadVideo } from '../../services/api';
import toast from 'react-hot-toast';

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
            ${isUploading ? 'border-accent-purple bg-accent-purple/5' : 'border-border-light hover:border-accent-purple/60 hover:bg-accent-purple/5'}`}>
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
  const { currentVideo, isHost, setVideoSource, notifyUploading } = useRoom();
  const videoRef = useRef(null);

  // ─ Host-only blob URL for instant local playback ─────────────────────────
  const [blobUrl, setBlobUrl] = useState(null);
  const blobUrlRef = useRef(null); // for cleanup in effects

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
  const currentTimeRef = useRef(0); // live ref for upload callback

  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    setVideoEl(el);
  }, []);

  useVideoSync(videoEl);

  // Track currentTime in a ref so the upload callback can read it without a stale closure
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  useEffect(() => {
    if (!videoEl) return;
    const onTimeUpdate = () => { setCurrentTime(videoEl.currentTime); };
    const onLoadedMetadata = () => setDuration(videoEl.duration);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    videoEl.addEventListener('waiting', onWaiting);
    videoEl.addEventListener('canplay', onCanPlay);
    return () => {
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.removeEventListener('waiting', onWaiting);
      videoEl.removeEventListener('canplay', onCanPlay);
    };
  }, [videoEl]);

  // Cleanup blob URL on unmount
  useEffect(() => () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // ── File upload: INSTANT local play + background upload ────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Create blob URL → host starts watching IMMEDIATELY
    const localUrl = URL.createObjectURL(file);
    blobUrlRef.current = localUrl;
    setBlobUrl(localUrl);
    setShowSourcePicker(false); // close modal right away

    // 2. Notify participants that upload is starting (they'll see waiting state)
    notifyUploading(file.name);
    toast.success('▶ Playing now! Uploading for guests in background…', { duration: 4000 });

    // 3. Upload to Cloudinary in background
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const data = await uploadVideo(file, setUploadProgress);

      // 4. Broadcast final URL with host's CURRENT playback position
      const ct = currentTimeRef.current;
      const playing = !videoRef.current?.paused;
      setVideoSource(
        { url: data.url, type: 'file', title: file.name },
        { currentTime: ct, isPlaying: playing, preserveState: true }
      );

      // 5. Swap host's video from blob → Cloudinary URL, preserving current time
      const savedTime = videoRef.current?.currentTime ?? ct;
      const wasPlaying = !videoRef.current?.paused;
      URL.revokeObjectURL(localUrl);
      blobUrlRef.current = null;
      setBlobUrl(null); // currentVideo.url now takes over (Cloudinary)
      // After React re-renders with Cloudinary src, seek to saved position
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = savedTime;
          if (wasPlaying) videoRef.current.play().catch(() => {});
        }
      }, 300);

      toast.success('☁ Uploaded! Guests are now syncing.', { duration: 3000 });
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
      // Keep playing from blob until user changes source
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

  // The src the host's <video> actually plays from:
  // blob URL while uploading, then currentVideo.url (Cloudinary) after upload
  const hostSrc = blobUrl || (currentVideo?.type !== 'youtube' && currentVideo?.type !== 'uploading' ? currentVideo?.url : null);

  // Portal modal (shared for all video types)
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

  // ── YouTube player ────────────────────────────────────────────────────────
  if (currentVideo?.type === 'youtube') {
    return (
      <div className="relative w-full h-full bg-black">
        <YouTubePlayer videoId={currentVideo.url} />
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

  // ── Participant "waiting for upload" state ────────────────────────────────
  if (!isHost && currentVideo?.type === 'uploading') {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-accent-purple/10 flex items-center justify-center animate-pulse">
            <CloudUpload className="w-9 h-9 text-accent-purple" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">Host is uploading a video</h3>
            <p className="text-text-secondary text-sm">
              <span className="text-accent-purple font-medium">{currentVideo.title || 'Video'}</span>
            </p>
            <p className="text-text-muted text-xs mt-2 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              You'll be synced automatically when it's ready
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
      className="relative w-full h-full bg-black flex items-center justify-center group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Background upload progress bar (host only, top of screen) */}
      {isHost && isUploading && (
        <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-bg-hover">
          <div
            className="h-full bg-gradient-to-r from-accent-purple to-accent-red transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {hostSrc ? (
        <video
          ref={setVideoRef}
          className="w-full h-full object-contain"
          src={hostSrc}
          playsInline
          preload="auto"
          crossOrigin={currentVideo?.type === 'file' || blobUrl ? undefined : undefined}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-bg-hover flex items-center justify-center animate-pulse-glow">
            <Play className="w-10 h-10 text-accent-red ml-1" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-primary mb-2">No Video Loaded</h3>
            <p className="text-text-secondary text-sm">
              {isHost ? 'Choose a video to start watching together' : 'Waiting for host to load a video…'}
            </p>
          </div>
          {isHost && (
            <button className="btn-primary" onClick={() => setShowSourcePicker(true)}>
              <Upload className="w-4 h-4" /> Load Video
            </button>
          )}
        </div>
      )}

      {/* Buffering spinner */}
      {isLoading && hostSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-12 h-12 text-accent-red animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      {hostSrc && (
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

      {sourcePicker}
    </div>
  );
};

export default VideoPlayer;
