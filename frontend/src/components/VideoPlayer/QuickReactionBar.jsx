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
    positionClasses = 'absolute bottom-24 left-1/2 -translate-x-1/2 z-[60]';
  } else {
    positionClasses = 'w-fit mx-auto py-2';
  }

  return (
    <div className={`transition-all duration-300 animate-slide-up ${positionClasses} ${className || ''}`}>
      <div className="flex gap-2 p-1.5 bg-[#0a0a0b]/90 backdrop-blur-3xl border border-white/5 rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.8)] px-2 py-2">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="w-12 h-12 flex items-center justify-center text-2xl hover:bg-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:scale-110 active:scale-95"
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
