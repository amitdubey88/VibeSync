import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

/**
 * HLSPlayer Component
 * 
 * Renders an HLS (.m3u8) video stream using hls.js. 
 * Falls back to native HTML5 video if the browser natively supports HLS (e.g. Safari).
 * 
 * Hands its ref back to VideoPlayer.jsx via `onReady` for native sync.
 */
const HLSPlayer = ({ src, autoPlay, onCanPlay, onReady }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    let active = true;
    const video = videoRef.current;
    if (!video || !src) return;

    const initHLS = () => {
      if (!active) return;
      
      // Cleanup previous instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          // Adjust HLS params for live/stream viewing if needed
          startLevel: -1,
          debug: false,
        });
        hlsRef.current = hls;
        
        hls.loadSource(src);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!active) return;
          if (onCanPlay) onCanPlay();
          // BUGFIX: call onReady here — AFTER hls.js has fully attached to the video
          // element and parsed the manifest. Calling it before (synchronously after
          // initHLS()) handed an uninitialised element to VideoPlayer, causing
          // captureStream() to capture black frames and participants to see nothing.
          if (onReady) onReady(video);
          if (autoPlay) {
            video.play().catch(() => {});
          }
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal && active) {
            console.error('[HLSPlayer] Fatal error:', data);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // try to recover network error
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                // cannot recover
                hls.destroy();
                break;
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS fallback (Safari)
        video.src = src;
        video.addEventListener('loadedmetadata', () => {
          if (!active) return;
          if (onCanPlay) onCanPlay();
          // BUGFIX: same as above — notify parent only once the element is ready
          if (onReady) onReady(video);
          if (autoPlay) {
            video.play().catch(() => {});
          }
        });
      }
    };

    initHLS();

    // NOTE: onReady is intentionally NOT called here anymore.
    // It is now called inside MANIFEST_PARSED / loadedmetadata above,
    // so VideoPlayer only gets the element once hls.js is fully attached.

    return () => {
      active = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (onReady) onReady(null);
    };
  }, [src, autoPlay, onCanPlay, onReady]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        key={src} // Force remount if src changes sharply
        className="w-full h-full object-contain"
        playsInline
        preload="auto"
      />
    </div>
  );
};

export default HLSPlayer;
