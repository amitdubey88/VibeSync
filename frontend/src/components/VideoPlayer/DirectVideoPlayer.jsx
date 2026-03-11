import { useEffect, useRef } from 'react';

/**
 * DirectVideoPlayer Component
 * 
 * Renders a standard HTML5 `<video>` tag for direct media files (MP4, WebM) 
 * or Blob URLs (Decrypted files, instantaneous host uploads).
 * 
 * Hands its ref back to VideoPlayer.jsx via `onReady` for native sync.
 */
const DirectVideoPlayer = ({ src, autoPlay, onCanPlay, onReady }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (onReady && videoRef.current) {
      onReady(videoRef.current);
    }
    // Cleanup reference on unmount
    return () => {
      if (onReady) onReady(null);
    };
  }, [src, onReady]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        key={src}
        className="w-full h-full object-contain"
        src={src}
        playsInline
        preload="auto"
        autoPlay={autoPlay}
        onCanPlay={onCanPlay}
      />
    </div>
  );
};

export default DirectVideoPlayer;
