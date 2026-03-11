import { useState, useCallback, useRef, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useWebRTCContext } from '../../context/WebRTCContext';
import { formatTime } from '../../utils/helpers';
import toast from 'react-hot-toast';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Upload,
  Mic, MicOff, Phone, Pin
} from 'lucide-react';

const VideoControls = ({ videoRef, videoEl, currentTime, duration, isHost, onLoadClick, visible }) => {
  const { videoState, currentVideo, clips, sendClip } = useRoom();
  const { isMuted, toggleMute, voiceError } = useWebRTCContext();
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

  // Sync mute state from keyboard shortcuts (KeyM)
  useEffect(() => {
    const onToggleMute = (e) => setIsMutedLocal(e.detail);
    window.addEventListener('video:toggle-mute', onToggleMute);
    return () => window.removeEventListener('video:toggle-mute', onToggleMute);
  }, []);

  // Sync volume state to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMutedLocal ? 0 : volume;
      videoRef.current.muted = isMutedLocal;
    }
  }, [videoRef, videoEl, volume, isMutedLocal]);

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
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

  const isLive = videoState?.type === 'live' || videoState?.type === 'uploading' || (currentVideo?.type === 'live' || currentVideo?.type === 'uploading');
  
  // For participants in live mode, use the synced time/duration from host
  const displayTime = (!isHost && isLive && videoState?.currentTime !== undefined) ? videoState.currentTime : currentTime;
  // For live streams, prefer synced duration from host; fall back to local duration
  const displayDuration = (duration > 0 && duration !== Infinity)
    ? duration
    : (videoState?.duration > 0 ? videoState.duration : (videoEl?.duration > 0 && videoEl.duration !== Infinity ? videoEl.duration : 0));
  
  const progress = displayDuration > 0 ? (displayTime / displayDuration) * 100 : 0;

  return (
    <div className={`absolute inset-x-0 bottom-0 video-gradient-bottom pt-24 pb-6 md:pb-5 px-5 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
      {/* ── Progress bar (Visible to everyone, seekable by host) ── */}
      <div
        className={`relative h-1 rounded-full bg-white/20 mb-3 ${isHost ? 'cursor-pointer hover:h-2' : 'cursor-default'} transition-all duration-150 group/progress`}
        onClick={isHost ? handleSeek : undefined}
      >
        <div
          className="h-full rounded-full bg-accent-red transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
        {/* Clip Markers */}
        {clips && clips.map(clip => (
          <div 
            key={clip.id}
            className="absolute top-0 bottom-0 w-0.5 bg-accent-purple shadow-[0_0_8px_rgba(139,92,246,0.8)] z-10"
            style={{ left: `${displayDuration > 0 ? (clip.time / displayDuration) * 100 : 0}%` }}
            title={`Clip by ${clip.username}`}
          />
        ))}

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
        <button onClick={toggleMuteVideo} className="btn-icon text-white">
          {isMutedLocal || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range" min="0" max="1" step="0.05"
          value={isMutedLocal ? 0 : volume}
          onChange={handleVolume}
          className="w-20 accent-accent-red cursor-pointer"
        />

        {/* Time */}
        <span className="text-white/70 text-xs font-mono select-none ml-1">
          {formatTime(displayTime)} / {formatTime(displayDuration)}
        </span>

        {/* Mic toggle */}
        <div className="flex items-center gap-1.5 ml-2">
          {voiceError ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-500 text-[9px] font-bold uppercase transition-all animate-pulse pointer-events-none">
              <MicOff className="w-3 h-3" />
              <span>Mic Denied</span>
            </div>
          ) : (
            <button
              onClick={toggleMute}
              className={`btn-icon rounded-full w-8 h-8 transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}
              title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Load video button (host only) */}
        {isHost && onLoadClick && (
          <button onClick={onLoadClick} className="btn-icon text-white" title="Change video">
            <Upload className="w-4 h-4" />
          </button>
        )}

        {/* Clip moment */}
        <button 
          onClick={() => sendClip(currentTime)} 
          className="btn-icon text-white hover:text-accent-red transition-colors" 
          title="Clip This Moment"
        >
          <Pin className="w-4 h-4" />
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
