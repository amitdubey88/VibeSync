import { useRef, useState, useEffect, useCallback } from 'react';
import { useRoom } from '../../context/RoomContext';
import useVideoSync from '../../hooks/useVideoSync';
import VideoControls from './VideoControls';
import YouTubePlayer from './YouTubePlayer';
import { Play, Upload, Link, Loader2 } from 'lucide-react';
import { uploadVideo } from '../../services/api';
import toast from 'react-hot-toast';

const VideoPlayer = () => {
  const { currentVideo, isHost, setVideoSource } = useRoom();
  const videoRef = useRef(null);

  // ── Local UI state ───────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoEl, setVideoEl] = useState(null); // actual DOM element
  const controlsTimer = useRef(null);

  // ── KEY FIX: use a callback ref so we know exactly when <video> mounts ──
  // We store the actual DOM node in `videoEl` state. This triggers a re-render
  // and passes the live element to useVideoSync, which re-runs its effects.
  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    setVideoEl(el);
  }, []);

  // Pass the DOM element directly to the hook (not the ref object)
  useVideoSync(videoEl);

  // ── Attach UI-only listeners to the video element ────────────────────────
  useEffect(() => {
    if (!videoEl) return;
    const onTimeUpdate = () => setCurrentTime(videoEl.currentTime);
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
  }, [videoEl]); // re-runs when the video element mounts/changes

  // ── Auto-hide controls ───────────────────────────────────────────────────
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const data = await uploadVideo(file, setUploadProgress);
      setVideoSource({ url: data.url, type: 'file', title: file.name });
      setShowSourcePicker(false);
      toast.success('Video loaded!');
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // ── URL / YouTube submit ─────────────────────────────────────────────────
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    const ytMatch = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
      setVideoSource({ url: ytMatch[1], type: 'youtube', title: 'YouTube Video' });
    } else {
      setVideoSource({ url, type: 'url', title: url.split('/').pop() || 'Video' });
    }
    setShowSourcePicker(false);
    setUrlInput('');
    toast.success('Video source set!');
  };

  // ── YouTube: wrap in container so host can still change source ───────────
  if (currentVideo?.type === 'youtube') {
    return (
      <div className="relative w-full h-full bg-black">
        <YouTubePlayer videoId={currentVideo.url} />

        {/* Host-only persistent "Change Video" button */}
        {isHost && (
          <button
            onClick={() => setShowSourcePicker(true)}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/60 hover:bg-black/80
                       border border-white/20 hover:border-white/40 text-white text-xs font-semibold
                       px-3 py-1.5 rounded-lg backdrop-blur-sm transition-all duration-200"
            title="Change video source"
          >
            <Upload className="w-3.5 h-3.5" />
            Change Video
          </button>
        )}

        {/* Source picker modal */}
        {showSourcePicker && isHost && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setShowSourcePicker(false)}
          >
            <div className="glass rounded-2xl p-6 w-full max-w-md animate-slide-up">
              <h3 className="text-xl font-bold mb-1 text-text-primary">Change Video</h3>
              <p className="text-text-muted text-sm mb-6">Replace the current video for everyone in the room</p>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-text-secondary mb-3">
                  <Upload className="inline w-4 h-4 mr-1" /> Upload File (MP4, WebM)
                </label>
                <label className={`flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all
                  ${isUploading ? 'border-accent-purple' : 'border-border-light hover:border-accent-purple/50'}`}>
                  <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  {isUploading ? (
                    <div className="text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-accent-purple mx-auto mb-1" />
                      <span className="text-sm text-accent-purple font-medium">{uploadProgress}% uploaded…</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-6 h-6 text-text-muted mx-auto mb-1" />
                      <span className="text-sm text-text-secondary">Click to select a video file</span>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <hr className="flex-1 border-border-dark" />
                <span className="text-text-muted text-xs">OR</span>
                <hr className="flex-1 border-border-dark" />
              </div>

              <form onSubmit={handleUrlSubmit}>
                <label className="block text-sm font-semibold text-text-secondary mb-3">
                  <Link className="inline w-4 h-4 mr-1" /> New YouTube / Direct URL
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
                  <button type="submit" className="btn-primary px-4">Go</button>
                </div>
              </form>

              <button className="btn-ghost w-full mt-4" onClick={() => setShowSourcePicker(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-black flex items-center justify-center group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* ── Video element ── */}
      {currentVideo ? (
        <video
          ref={setVideoRef}
          className="w-full h-full object-contain"
          src={currentVideo.url}
          playsInline
          preload="auto"
          crossOrigin={currentVideo.type === 'file' ? 'anonymous' : undefined}
        />
      ) : (
        // When no video, keep the ref null so videoEl state becomes null too
        // (useEffect cleanup runs automatically)
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

      {/* ── Buffering spinner ── */}
      {isLoading && currentVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-12 h-12 text-accent-red animate-spin" />
        </div>
      )}

      {/* ── Controls overlay ── */}
      {currentVideo && (
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

      {/* ── Source picker modal ── */}
      {showSourcePicker && isHost && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowSourcePicker(false)}
        >
          <div className="glass rounded-2xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-xl font-bold mb-6 text-text-primary">Load Video</h3>

            {/* File upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-text-secondary mb-3">
                <Upload className="inline w-4 h-4 mr-1" /> Upload File (MP4, WebM)
              </label>
              <label className={`flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all
                ${isUploading ? 'border-accent-purple' : 'border-border-light hover:border-accent-purple/50'}`}>
                <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                {isUploading ? (
                  <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-accent-purple mx-auto mb-1" />
                    <span className="text-sm text-accent-purple font-medium">{uploadProgress}% uploaded…</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-6 h-6 text-text-muted mx-auto mb-1" />
                    <span className="text-sm text-text-secondary">Click to select a video file</span>
                  </div>
                )}
              </label>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <hr className="flex-1 border-border-dark" />
              <span className="text-text-muted text-xs">OR</span>
              <hr className="flex-1 border-border-dark" />
            </div>

            {/* URL input */}
            <form onSubmit={handleUrlSubmit}>
              <label className="block text-sm font-semibold text-text-secondary mb-3">
                <Link className="inline w-4 h-4 mr-1" /> YouTube / Direct URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="https://youtube.com/watch?v=... or video URL"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn-primary px-4">Go</button>
              </div>
            </form>

            <button className="btn-ghost w-full mt-4" onClick={() => setShowSourcePicker(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
