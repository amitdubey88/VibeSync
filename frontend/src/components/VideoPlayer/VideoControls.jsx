import { useState, useCallback, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';
import { formatTime } from '../../utils/helpers';
import toast from 'react-hot-toast';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Upload, PictureInPicture
} from 'lucide-react';

const VideoControls = ({ videoRef, currentTime, duration, isHost, onLoadClick }) => {
  const { videoState } = useRoom();
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);

  const isPlaying = videoState?.isPlaying || false;

  const togglePlay = useCallback(() => {
    if (!isHost) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, [videoRef, isHost]);

  const handleSeek = useCallback((e) => {
    if (!isHost || !videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = ratio * duration;
  }, [videoRef, isHost, duration]);

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, [videoRef, isMuted]);

  const toggleFullscreen = useCallback(async () => {
    const container = videoRef.current?.closest('.group');
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
        
        // Lock orientation to landscape on mobile if supported
        if (window.screen?.orientation?.lock) {
          try {
            await window.screen.orientation.lock('landscape');
          } catch (err) {
            console.warn('Orientation lock failed:', err);
          }
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        
        // Unlock orientation when exiting fullscreen
        if (window.screen?.orientation?.unlock) {
          window.screen.orientation.unlock();
        }
      }
    } catch (err) {
      console.error('Fullscreen toggle failed:', err);
    }
  }, [videoRef]);

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.pictureInPictureEnabled) {
      toast.error('Picture-in-Picture is not supported in this browser.');
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await video.requestPictureInPicture();
        setIsPiP(true);
        // Update state when user closes PiP via the native browser controls
        video.addEventListener('leavepictureinpicture', () => setIsPiP(false), { once: true });
      }
    } catch (err) {
      console.error('Failed to toggle PiP:', err);
      toast.error('Could not enable Picture-in-Picture.');
    }
  }, [videoRef]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 video-gradient-bottom pt-16 pb-3 px-4">
      {/* ── Progress bar ── */}
      <div
        className={`relative h-1 rounded-full bg-white/20 mb-3 ${isHost ? 'cursor-pointer hover:h-2' : 'cursor-default'} transition-all duration-150 group/progress`}
        onClick={handleSeek}
      >
        <div
          className="h-full rounded-full bg-accent-red transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
        {isHost && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
          />
        )}
      </div>

      {/* ── Buttons row ── */}
      <div className="flex items-center gap-3">
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          className={`btn-icon text-white ${!isHost && 'opacity-40 cursor-not-allowed'}`}
          disabled={!isHost}
          title={isHost ? (isPlaying ? 'Pause' : 'Play') : 'Only host can control'}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        {/* Volume */}
        <button onClick={toggleMute} className="btn-icon text-white">
          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range" min="0" max="1" step="0.05"
          value={isMuted ? 0 : volume}
          onChange={handleVolume}
          className="w-20 accent-accent-red cursor-pointer"
        />

        {/* Time */}
        <span className="text-white/70 text-xs font-mono select-none ml-1">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        {/* Load video button (host only) */}
        {isHost && onLoadClick && (
          <button onClick={onLoadClick} className="btn-icon text-white" title="Change video">
            <Upload className="w-4 h-4" />
          </button>
        )}

        {/* PiP */}
        <button
          type="button"
          onClick={togglePictureInPicture}
          className={`btn-icon text-white transition-colors ${isPiP ? 'text-accent-purple' : ''}`}
          title={isPiP ? 'Exit Picture in Picture' : 'Picture in Picture'}
        >
          <PictureInPicture className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button type="button" onClick={toggleFullscreen} className="btn-icon text-white" title="Fullscreen">
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {!isHost && (
        <p className="text-center text-xs text-white/30 mt-1 select-none">
          👑 Only the host can control playback
        </p>
      )}
    </div>
  );
};

export default VideoControls;
