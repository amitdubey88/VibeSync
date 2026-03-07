import { useState, useCallback, useRef, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useWebRTCContext } from '../../context/WebRTCContext';
import { formatTime } from '../../utils/helpers';
import toast from 'react-hot-toast';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Upload,
  Mic, MicOff, Phone
} from 'lucide-react';

const VideoControls = ({ videoRef, currentTime, duration, isHost, onLoadClick }) => {
  const { videoState } = useRoom();
  const { isInVoice, isMuted, toggleMute, joinVoice } = useWebRTCContext();
  const [volume, setVolume] = useState(1);
  const [isMutedLocal, setIsMutedLocal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Monitor fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement));
    };
    
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('msfullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('msfullscreenchange', onFsChange);
    };
  }, []);

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
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = (v === 0);
    }
    setIsMutedLocal(v === 0);
  };

  const toggleMuteVideo = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMutedLocal;
    videoRef.current.muted = newMuted;
    setIsMutedLocal(newMuted);
  }, [videoRef, isMutedLocal]);

  const toggleFullscreen = useCallback(async () => {
    const container = videoRef.current?.closest('.video-reaction-host');
    if (!container) return;

    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
          await container.msRequestFullscreen();
        }
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
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
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

  const isLive = videoState?.type === 'live' || videoState?.type === 'uploading';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute inset-x-0 bottom-0 video-gradient-bottom pt-20 pb-4 px-5">
      {/* ── Contextual Action Layer (Join Audio) ── */}
      {!isInVoice && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 animate-bounce-subtle flex justify-center w-full max-w-[200px] pointer-events-none">
           <button
             onClick={() => joinVoice(true)}
             className="pointer-events-auto flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent-purple/90 hover:bg-accent-purple backdrop-blur-md border border-white/30 text-white text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-[0_10px_30px_rgba(168,85,247,0.5)] whitespace-nowrap"
           >
             <Phone className="w-4 h-4" />
             <span>Join Live Audio</span>
           </button>
        </div>
      )}

      {/* ── Progress bar (Hidden if live) ── */}
      {!isLive && (
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
      )}

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
        <button onClick={toggleMuteVideo} className="btn-icon text-white">
          {isMutedLocal || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
