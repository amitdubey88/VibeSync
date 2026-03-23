import { useState, useCallback, useEffect } from "react";
import { useRoom } from "../../context/RoomContext";
import { useWebRTCContext } from "../../context/WebRTCContext";
import { formatTime } from "../../utils/helpers";
// Empty replacement to remove toast import entirely avoiding blank lines
import {
  PlayIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeMutedIcon,
  MaximizeIcon,
  MinimizeIcon,
  UploadIcon,
  MicIcon,
  MicOffIcon,
  PinIcon,
  CrownIcon,
  DeleteIcon,
} from "../UI/SharpIcons";

const VideoControls = ({
  videoRef,
  videoEl,
  currentTime,
  duration,
  buffered,
  isHost,
  isCoHost,
  onLoadClick,
  visible,
}) => {
  const { videoState, currentVideo, clips, sendClip, setVideoSource } = useRoom();
  const { isMuted, toggleMute, voiceError } = useWebRTCContext();
  const [volume, setVolume] = useState(1);
  const [isMutedLocal, setIsMutedLocal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Monitor fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement
        ),
      );
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("msfullscreenchange", onFsChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      document.removeEventListener("msfullscreenchange", onFsChange);
    };
  }, []);

  const isPlaying = videoState?.isPlaying || false;

  const togglePlay = useCallback(() => {
    if (!isHost && !isCoHost) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, isHost]);

  const isLive =
    videoState?.type === "live" ||
    videoState?.type === "uploading" ||
    currentVideo?.type === "live" ||
    currentVideo?.type === "uploading";

  // For participants in live mode, use the synced time/duration from host accurately
  const displayTime =
    !isHost && isLive ? videoState?.currentTime || 0 : currentTime;

  // For live streams, prefer synced duration from host; fall back to local element duration
  let displayDuration = duration > 0 && duration !== Infinity ? duration : 0;
  if (isLive && videoState?.duration > 0) {
    displayDuration = videoState.duration;
  } else if (videoEl?.duration > 0 && videoEl.duration !== Infinity) {
    displayDuration = videoEl.duration;
  }

  // Final fallback to prevent 0/0 or NaN
  const safeDuration = Math.max(displayDuration, 0);
  const safeTime = Math.min(Math.max(displayTime, 0), safeDuration || Infinity);

  const handleSeek = useCallback(
    (e) => {
      // For YouTube Proxy, duration is available but it's an EventTarget, not a DOM element
      const video = videoRef.current;

      // Fallback: try to grab duration directly from the element/proxy if displayDuration failed (is 0)
      const effectiveDuration =
        displayDuration > 0 ? displayDuration : video?.duration || 0;

      if ((!isHost && !isCoHost) || !video || effectiveDuration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const targetTime = ratio * effectiveDuration;

      // The setter exists on both HTMLVideoElement and YouTubeVideoProxy
      try {
        video.currentTime = targetTime;
      } catch (err) {
        console.error(
          "[VideoControls] handleSeek failed setting currentTime:",
          err,
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [videoRef, isHost, displayDuration],
  );

  // Sync mute state from keyboard shortcuts (KeyM)
  useEffect(() => {
    const onToggleMute = (e) => setIsMutedLocal(e.detail);
    window.addEventListener("video:toggle-mute", onToggleMute);
    return () => window.removeEventListener("video:toggle-mute", onToggleMute);
  }, []);

  // Sync volume state FROM video element when modified externally (e.g. autoplay fallback)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onVolumeChange = () => {
      // Sync local state if the video was muted externally
      setIsMutedLocal(video.muted || video.volume === 0);
      if (video.volume > 0) setVolume(video.volume);
    };

    video.addEventListener("volumechange", onVolumeChange);
    // Initial sync
    onVolumeChange();

    return () => video.removeEventListener("volumechange", onVolumeChange);
  }, [videoRef, videoEl]);

  // Sync volume state TO video element ONLY when user interacts with sliders
  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMutedLocal(v === 0);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
  };

  const toggleMuteVideo = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMutedLocal;
    videoRef.current.muted = newMuted;
    setIsMutedLocal(newMuted);
    if (!newMuted && volume === 0) {
      setVolume(1);
      videoRef.current.volume = 1;
    }
  }, [videoRef, isMutedLocal, volume]);

  const toggleFullscreen = useCallback(() => {
    // BUGFIX: videoRef.current might be a YouTubeVideoProxy (not a DOM element),
    // which doesn't have a .closest() method. We should search the DOM directly
    // for the main container or fall back to the document body.
    let container = null;
    if (videoRef.current instanceof Element) {
      container = videoRef.current.closest(".video-reaction-host");
    }
    // Deep fallback: grab the wrapper by class. If not found, use document.documentElement
    // (document.documentElement is standard for full-page fullscreen, body often fails on Safari/iOS)
    if (!container) {
      container =
        document.querySelector(".video-reaction-host") ||
        document.documentElement;
    }

    try {
      if (
        !document.fullscreenElement &&
        !document.webkitFullscreenElement &&
        !document.msFullscreenElement
      ) {
        if (container.requestFullscreen) {
          container.requestFullscreen().catch((err) => console.warn(err));
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        }
        setIsFullscreen(true);

        // Lock orientation to landscape on mobile if supported
        if (window.screen?.orientation?.lock) {
          window.screen.orientation.lock("landscape").catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch((err) => console.warn(err));
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
        setIsFullscreen(false);

        // Unlock orientation when exiting fullscreen
        if (window.screen?.orientation?.unlock) {
          window.screen.orientation.unlock();
        }
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  }, [videoRef]);

  const progress = safeDuration > 0 ? (safeTime / safeDuration) * 100 : 0;
  const bufferedProgress =
    safeDuration > 0 ? (buffered / safeDuration) * 100 : 0;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-24 pb-6 md:pb-5 px-5 transition-all duration-300 ${visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
    >
      {/* ── Progress bar (Visible to everyone, seekable by host) ── */}
      <div
        className={`relative h-1.5 bg-white/20 mb-3 ${isHost ? "cursor-pointer hover:h-2" : "cursor-default"} transition-all duration-150 group/progress`}
        onClick={isHost || isCoHost ? handleSeek : undefined}
      >
        <div
          className="absolute h-full bg-white/20 transition-all duration-300"
          style={{ width: `${Math.min(bufferedProgress, 100)}%` }}
        />
        <div
          className="relative h-full bg-obsidian-primary transition-all duration-150 shadow-[0_0_15px_rgba(139,92,246,0.6)]"
          style={{ width: `${progress}%` }}
        />
        {/* Clip Markers */}
        {clips &&
          clips.map((clip) => (
            <div
              key={clip.id}
              className="absolute top-0 bottom-0 w-0.5 bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.8)] z-10"
              style={{
                left: `${safeDuration > 0 ? (clip.time / safeDuration) * 100 : 0}%`,
              }}
              title={`Clip by ${clip.username}`}
            />
          ))}

        {(isHost || isCoHost) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: "translate(-50%, -50%)" }}
          />
        )}
      </div>

      {/* ── Buttons row ── */}
      <div className="flex items-center gap-3">
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          className={`text-zinc-400 hover:text-obsidian-primary text-obsidian-on-surface-variant transition-colors ${!isHost && !isCoHost && "opacity-40 cursor-not-allowed"}`}
          disabled={!isHost && !isCoHost}
          title={
            isHost || isCoHost
              ? isPlaying
                ? "Pause"
                : "Play"
              : "Only host/co-host can control"
          }
        >
          {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>

        {/* Volume */}
        <button
          onClick={toggleMuteVideo}
          className="text-zinc-400 hover:text-obsidian-primary text-obsidian-on-surface-variant transition-colors"
        >
          {isMutedLocal || volume === 0 ? (
            <VolumeMutedIcon size={16} />
          ) : (
            <VolumeHighIcon size={16} />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={isMutedLocal ? 0 : volume}
          onChange={handleVolume}
          className="w-20 accent-obsidian-primary cursor-pointer"
        />

        {/* Time */}
        <span className="text-zinc-400 font-headline tracking-wider text-[10px] sm:text-xs font-mono select-none ml-1 whitespace-nowrap">
          {formatTime(safeTime)} / {formatTime(safeDuration)}
        </span>

        {/* Mic toggle */}
        <div className="flex items-center gap-1.5 ml-2">
          {voiceError ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/30 text-red-500 text-[9px] font-bold uppercase transition-all animate-pulse pointer-events-none">
              <MicOffIcon size={12} />
              <span>Mic Denied</span>
            </div>
          ) : (
            <button
              onClick={toggleMute}
              className={`btn-icon w-8 h-8 transition-all ${isMuted ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500"}`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOffIcon size={16} /> : <MicIcon size={16} />}
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Change video button (host only) */}
        {(isHost || isCoHost) && (
          <div className="flex items-center gap-2">
            <button
              onClick={onLoadClick}
              className="text-zinc-400 hover:text-obsidian-primary transition-colors"
              title="Change video"
            >
              <UploadIcon size={16} />
            </button>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to remove the current video?')) {
                  setVideoSource(null);
                }
              }}
              className="text-zinc-400 hover:text-red-500 transition-colors"
              title="Remove current video"
            >
              <DeleteIcon size={16} />
            </button>
          </div>
        )}

        {/* Clip moment */}
        <button
          onClick={() => sendClip(currentTime)}
          className="text-zinc-400 hover:text-obsidian-primary text-obsidian-on-surface-variant transition-colors  transition-colors"
          title="Clip This Moment"
        >
          <PinIcon size={16} />
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="text-zinc-400 hover:text-obsidian-primary text-obsidian-on-surface-variant transition-colors"
          title="Fullscreen"
        >
          {isFullscreen ? (
            <MinimizeIcon size={16} />
          ) : (
            <MaximizeIcon size={16} />
          )}
        </button>
      </div>

      {!isHost && !isCoHost && (
        <p className="flex items-center justify-center gap-2 text-center text-[10px] text-zinc-600 font-black uppercase tracking-widest mt-2 select-none">
          <CrownIcon size={12} className="text-obsidian-primary" />
          <span>Only the host and co-hosts can control playback</span>
        </p>
      )}
    </div>
  );
};

export default VideoControls;
