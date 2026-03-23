import { useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext';

const QuickReactionBar = ({ visible, className, isOverlay }) => {
  const { sendReaction } = useRoom();
  const [localVisible, setLocalVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  
  const emojis = ['👍', '❤️', '😂', '🔥', '👏', '😮', '💀', '🎉'];

  useEffect(() => {
    const handler = (e) => setLocalVisible(e.detail);
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    
    window.addEventListener('video:controls-visibility', handler);
    document.addEventListener('fullscreenchange', fsHandler);
    
    return () => {
      window.removeEventListener('video:controls-visibility', handler);
      document.removeEventListener('fullscreenchange', fsHandler);
    };
  }, []);

  const isVisible = visible !== undefined ? visible : localVisible;

  // Don't render anything if not visible
  if (!isVisible) return null;

  // Dynamic positioning logic:
  // 1. If Overlay (Video Player / Fullscreen): Absolute overlay at bottom
  // 2. Otherwise: w-fit mx-auto (Chat Panel inline)
  let positionClasses = '';
  if (isFullscreen || isOverlay) {
    positionClasses = 'absolute bottom-24 left-1/2 -translate-x-1/2 z-[60] w-fit max-w-[90%]';
  } else {
    positionClasses = 'w-full py-1.5';
  }

  return (
    <div className={`transition-all duration-300 animate-slide-up ${positionClasses} ${className || ''}`}>
      <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2.5 p-2 bg-gradient-to-r from-obsidian-surface/95 via-obsidian-surface/90 to-obsidian-surface/85 backdrop-blur-3xl border border-obsidian-primary/20 shadow-[0_15px_50px_rgba(170,85,255,0.15),0_0_30px_rgba(170,85,255,0.1)] rounded-2xl px-3 py-2">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className={`${isFullscreen ? 'w-9 h-9 text-lg' : 'w-11 h-11 md:w-13 md:h-13 text-2xl md:text-3xl'} flex items-center justify-center hover:bg-obsidian-primary/15 transition-all duration-200 cubic-bezier(0.22,1,0.36,1) hover:-translate-y-1 hover:scale-125 active:scale-90 rounded-lg hover:shadow-[0_0_15px_rgba(170,85,255,0.3)]`}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickReactionBar;
