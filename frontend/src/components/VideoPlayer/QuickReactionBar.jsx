import { useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext';

const QuickReactionBar = ({ visible, className }) => {
  const { sendReaction } = useRoom();
  const [localVisible, setLocalVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const emojis = ['👍', '❤️', '😂', '🔥', '👏', '😮', '💀', '🎉'];

  useEffect(() => {
    const handler = (e) => setLocalVisible(e.detail);
    const resizeHandler = () => setIsMobile(window.innerWidth < 768);
    
    window.addEventListener('video:controls-visibility', handler);
    window.addEventListener('resize', resizeHandler);
    
    return () => {
      window.removeEventListener('video:controls-visibility', handler);
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  const isVisible = visible !== undefined ? visible : localVisible;

  if (!isVisible) return null;

  // Dynamic positioning: fixed above chat on mobile, absolute inside video on desktop
  const positionClasses = isMobile 
    ? 'fixed bottom-[70px] left-1/2 -translate-x-1/2 z-[60]' 
    : (className || 'bottom-20 left-1/2 -translate-x-1/2');

  return (
    <div className={`transition-all duration-300 animate-slide-up ${positionClasses}`}>
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
