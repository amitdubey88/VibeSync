import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useRoom } from '../../context/RoomContext';
import VideoReactionBar from './VideoReactionBar';
import { PictureInPicture } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * YouTube Iframe API Player with sync support.
 * The YT player fires events that the host emits to the room,
 * and guests receive sync events that control the YT player.
 */
const YouTubePlayer = ({ videoId }) => {
  const { socket } = useSocket();
  const { room, isHost, setVideoState } = useRoom();
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const [isPiP, setIsPiP] = useState(false);
  const pipWindowRef = useRef(null);

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
        playerVars: { controls: isHost ? 1 : 0, rel: 0, modestbranding: 1 },
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

    return () => {
      playerRef.current?.destroy();
      // Also close any open PiP window when video changes
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
        setIsPiP(false);
      }
    };
  }, [videoId]);

  // Listen for sync events (guests receive from host via socket)
  useEffect(() => {
    if (!socket) return; // was: if (!socket || !playerRef.current) return
    // playerRef.current is checked INSIDE each handler (player will be ready by the time events fire)

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

  // ── YouTube PiP via Document Picture-in-Picture API ──────────────────────
  const toggleYouTubePiP = useCallback(async () => {
    // If there's already an open PiP window, close it
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setIsPiP(false);
      return;
    }

    // Document PiP API — supported in Chrome 116+
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

      // Move the iframe into the PiP window
      const pipDoc = pipWindow.document;
      pipDoc.documentElement.style.cssText = 'margin:0;padding:0;background:#000;width:100%;height:100%;';
      pipDoc.body.style.cssText = 'margin:0;padding:0;width:100%;height:100%;';
      iframeEl.style.cssText = 'width:100%;height:100%;border:none;';
      pipDoc.body.appendChild(iframeEl);

      // When the PiP window is closed, put iframe back
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
    <div className="w-full h-full bg-black flex items-center justify-center video-reaction-host relative">
      <div className="w-full h-full" ref={containerRef} />

      {/* PiP Button */}
      <button
        type="button"
        onClick={toggleYouTubePiP}
        title={isPiP ? 'Exit Picture in Picture' : 'Picture in Picture'}
        className={`absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
          bg-black/60 backdrop-blur-sm border border-white/10 text-white text-xs font-semibold
          hover:bg-black/80 hover:border-white/30 transition-all duration-200
          ${isPiP ? 'text-accent-purple border-accent-purple/50' : ''}`}
      >
        <PictureInPicture className="w-3.5 h-3.5" />
        {isPiP ? 'Exit PiP' : 'PiP'}
      </button>

      {/* Reaction Bar */}
      <VideoReactionBar />

      {!isHost && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/30 select-none">
          👑 Only the host can control playback
        </div>
      )}
    </div>
  );
};

export { YouTubePlayer };
export default YouTubePlayer;
