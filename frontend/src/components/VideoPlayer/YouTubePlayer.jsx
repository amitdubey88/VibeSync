import { useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useRoom } from '../../context/RoomContext';

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
    };
  }, [videoId]);

  // Listen for sync events (guests)
  useEffect(() => {
    if (!socket || !playerRef.current) return;

    const onPlay = ({ currentTime }) => {
      if (isHost) return;
      isSyncingRef.current = true;
      playerRef.current?.seekTo(currentTime, true);
      playerRef.current?.playVideo();
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    };

    const onPause = ({ currentTime }) => {
      if (isHost) return;
      isSyncingRef.current = true;
      playerRef.current?.seekTo(currentTime, true);
      playerRef.current?.pauseVideo();
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    };

    const onSeek = ({ currentTime }) => {
      if (isHost) return;
      playerRef.current?.seekTo(currentTime, true);
    };

    const onSyncState = ({ videoState: vs }) => {
      playerRef.current?.seekTo(vs.currentTime, true);
      if (vs.isPlaying) playerRef.current?.playVideo();
      else playerRef.current?.pauseVideo();
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

  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="w-full h-full" ref={containerRef} />
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
