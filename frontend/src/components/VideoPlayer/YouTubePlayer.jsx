import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useRoom } from '../../context/RoomContext';
import VideoReactionBar from './VideoReactionBar';
import { PictureInPicture, Maximize2, Minimize2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * YouTube Iframe API Player with sync support.
 */
const YouTubePlayer = ({ videoId }) => {
  const { socket } = useSocket();
  const { room, isHost, setVideoState } = useRoom();
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const mainContainerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef(null);
  const pipWindowRef = useRef(null);

  const handleInteraction = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    // Load YouTube Iframe API script if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const initPlayer = () => {
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { 
          controls: isHost ? 1 : 0, 
          rel: 0, 
          modestbranding: 1,
          fs: 0, // Disable native fs to use our custom one for better control
          disablekb: isHost ? 0 : 1
        },
        events: {
          onReady: () => {
            if (!isHost && socket && room?.code) {
              socket.emit('video:request-sync', { roomCode: room.code });
            }
          },
          onStateChange: (event) => {
            if (!isHost || isSyncingRef.current) return;
            const YT = window.YT;
            const currentTime = playerRef.current.getCurrentTime();
            const code = room?.code;
            if (!socket || !code) return;

            if (event.data === YT.PlayerState.PLAYING) {
              socket.emit('video:play', { roomCode: code, currentTime });
              setVideoState((p) => ({ ...p, isPlaying: true, currentTime }));
            } else if (event.data === YT.PlayerState.PAUSED) {
              socket.emit('video:pause', { roomCode: code, currentTime });
              setVideoState((p) => ({ ...p, isPlaying: false, currentTime }));
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    // Monitor fullscreen changes
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      playerRef.current?.destroy();
      document.removeEventListener('fullscreenchange', onFsChange);
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
        setIsPiP(false);
      }
      clearTimeout(controlsTimerRef.current);
    };
  }, [videoId, isHost]);

  // Listen for sync events
  useEffect(() => {
    if (!socket) return;
    const onPlay = ({ currentTime }) => {
      if (isHost || !playerRef.current) return;
      isSyncingRef.current = true;
      playerRef.current.seekTo(currentTime, true);
      playerRef.current.playVideo();
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    };
    const onPause = ({ currentTime }) => {
      if (isHost || !playerRef.current) return;
      isSyncingRef.current = true;
      playerRef.current.seekTo(currentTime, true);
      playerRef.current.pauseVideo();
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    };
    const onSeek = ({ currentTime }) => {
      if (isHost || !playerRef.current) return;
      playerRef.current.seekTo(currentTime, true);
    };
    const onSyncState = ({ videoState: vs }) => {
      if (!playerRef.current) return;
      playerRef.current.seekTo(vs.currentTime, true);
      if (vs.isPlaying) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    };
    socket.on('video:play', onPlay);
    socket.on('video:pause', onPause);
    socket.on('video:seek', onSeek);
    socket.on('video:sync-state', onSyncState);
    return () => {
      socket.off('video:play', onPlay);
      socket.off('video:pause', onPause);
      socket.off('video:seek', onSeek);
      socket.off('video:sync-state', onSyncState);
    };
  }, [socket, isHost]);

  const toggleFullscreen = useCallback(async () => {
    const el = mainContainerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }
        
        if (window.screen?.orientation?.lock) {
          try { await window.screen.orientation.lock('landscape'); } catch (_) {}
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
        
        if (window.screen?.orientation?.unlock) window.screen.orientation.unlock();
      }
    } catch (err) {
      console.error('[YT Fullscreen]', err);
    }
  }, []);

  const toggleYouTubePiP = useCallback(async () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setIsPiP(false);
      return;
    }
    if (!window.documentPictureInPicture) {
      toast.error('Picture-in-Picture is not supported in your browser for YouTube.');
      return;
    }
    try {
      const iframeEl = containerRef.current?.querySelector('iframe');
      if (!iframeEl) { toast.error('Player not ready yet.'); return; }
      const width = Math.min(640, screen.width * 0.5);
      const height = Math.round(width * 9 / 16);
      const pipWindow = await window.documentPictureInPicture.requestWindow({ width, height });
      pipWindowRef.current = pipWindow;
      setIsPiP(true);
      const pipDoc = pipWindow.document;
      pipDoc.documentElement.style.cssText = 'margin:0;padding:0;background:#000;width:100%;height:100%;';
      pipDoc.body.style.cssText = 'margin:0;padding:0;width:100%;height:100%;';
      iframeEl.style.cssText = 'width:100%;height:100%;border:none;';
      pipDoc.body.appendChild(iframeEl);
      pipWindow.addEventListener('pagehide', () => {
        containerRef.current?.appendChild(iframeEl);
        iframeEl.style.cssText = '';
        pipWindowRef.current = null;
        setIsPiP(false);
      });
    } catch (err) {
      console.error('[YT PiP]', err);
      toast.error('Could not open Picture-in-Picture.');
    }
  }, []);

  return (
    <div 
      ref={mainContainerRef}
      className="w-full h-full bg-black flex items-center justify-center video-reaction-host relative group"
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
    >
      <div className="w-full h-full pointer-events-none sm:pointer-events-auto" ref={containerRef} />
      
      {/* Overlay to block events on mobile for smoother interaction, while allowing host controls */}
      {!isHost && (
        <div className="absolute inset-0 z-10 sm:hidden" onClick={handleInteraction} />
      )}

      {/* Control Buttons Group */}
      <div className={`absolute top-3 left-3 z-20 flex items-center gap-2 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* PiP Button */}
        <button
          type="button"
          onClick={toggleYouTubePiP}
          title={isPiP ? 'Exit PiP' : 'PiP'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
            bg-black/60 backdrop-blur-sm border border-white/10 text-white text-xs font-semibold
            hover:bg-black/80 hover:border-white/30 transition-all duration-200
            ${isPiP ? 'text-accent-purple border-accent-purple/50' : ''}`}
        >
          <PictureInPicture className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">{isPiP ? 'Exit PiP' : 'PiP'}</span>
        </button>

        {/* Fullscreen Button - accessible to everyone */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title="Fullscreen"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
            bg-black/60 backdrop-blur-sm border border-white/10 text-white text-xs font-semibold
            hover:bg-black/80 hover:border-white/30 transition-all duration-200"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="hidden xs:inline">{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
        </button>
      </div>

      {/* Reaction Bar */}
      <VideoReactionBar />

      {!isHost && (
        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 transition-opacity duration-300 pointer-events-none z-20 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-lg">
             <p className="text-[10px] sm:text-xs text-white/50 font-medium whitespace-nowrap">
              👑 Only the host can control playback
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export { YouTubePlayer };
export default YouTubePlayer;
