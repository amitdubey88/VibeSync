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
  // 2. Otherwise: centered inside parent
  let positionClasses = '';
  if (isFullscreen || isOverlay) {
    positionClasses = 'absolute bottom-24 left-1/2 -translate-x-1/2 z-[60] w-fit max-w-[90%]';
  } else {
    positionClasses = 'w-full py-1 flex justify-center';
  }

  // Button size logic:
  // Fullscreen: w-9 h-9
  // Overlay (not FS): w-11 h-11
  // Chat Panel (not overlay): w-8 h-8 on mobile, w-9 on desktop
  const buttonSizeClass = isFullscreen 
    ? 'w-9 h-9 text-lg' 
    : (isOverlay ? 'w-11 h-11 text-2xl' : 'w-8 h-8 md:w-9 md:h-9 text-xl md:text-2xl');

  return (
    <div className={`transition-all duration-300 animate-slide-up ${positionClasses} ${className || ''}`}>
      <div className="flex flex-wrap items-center justify-center gap-1 md:gap-2 p-1.5 md:p-2 bg-gradient-to-r from-obsidian-surface/95 via-obsidian-surface/90 to-obsidian-surface/85 backdrop-blur-3xl border border-obsidian-primary/20 shadow-[0_15px_50px_rgba(170,85,255,0.15),0_0_30px_rgba(170,85,255,0.1)] rounded-2xl px-2.5 py-1.5 md:px-3 md:py-2">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className={`${buttonSizeClass} flex items-center justify-center hover:bg-obsidian-primary/15 transition-all duration-200 cubic-bezier(0.22,1,0.36,1) hover:-translate-y-1 hover:scale-125 active:scale-90 rounded-lg hover:shadow-[0_0_15px_rgba(170,85,255,0.3)]`}
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
