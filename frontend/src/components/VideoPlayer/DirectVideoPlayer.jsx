import { useEffect, useRef } from 'react';

/**
 * DirectVideoPlayer Component
 * 
 * Renders a standard HTML5 `<video>` tag for direct media files (MP4, WebM) 
 * or Blob URLs (Decrypted files, instantaneous host uploads).
 * 
 * Hands its ref back to VideoPlayer.jsx via `onReady` for native sync.
 */
const DirectVideoPlayer = ({ src, autoPlay, onCanPlay, onReady, onError }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onReady) return;

    // BUGFIX: Previously called onReady immediately at mount — before the browser
    // had attached any data to the element. VideoPlayer would then attach event
    // listeners to an uninitialised <video>, causing 'waiting' to fire immediately
    // (no data buffered) while 'canplay' was missed, leaving the spinner stuck.
    // Now we wait for 'loadedmetadata' (duration & dimensions known) before handing
    // the element up. If metadata is already available, notify synchronously.
    const notify = () => onReady(video);

    if (video.readyState >= 1) {
      // Metadata already loaded (e.g. blob: URLs load instantly)
      notify();
    } else {
      video.addEventListener('loadedmetadata', notify, { once: true });
    }

    return () => {
      video.removeEventListener('loadedmetadata', notify);
      onReady(null);
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
        onError={onError}
        // Prevent the browser's native controls from appearing (e.g. pressing F opens browser fullscreen)
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};

export default DirectVideoPlayer;
