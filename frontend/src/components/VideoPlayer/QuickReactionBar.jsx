import { useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext';

const QuickReactionBar = ({ visible, className }) => {
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
  // 1. If Fullscreen: Absolute overlay inside video player
  // 2. Otherwise: w-fit mx-auto (Chat Panel container handles layout)
  let positionClasses = '';
  if (isFullscreen) {
    positionClasses = 'absolute bottom-24 left-1/2 -translate-x-1/2 z-[60]';
  } else {
    positionClasses = 'w-fit mx-auto py-2';
  }

  return (
    <div className={`transition-all duration-300 animate-slide-up ${positionClasses} ${className || ''}`}>
      <div className="flex gap-2 p-1.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-90"
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
