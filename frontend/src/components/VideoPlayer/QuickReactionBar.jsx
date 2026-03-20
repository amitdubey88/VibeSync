import { useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext';

const QuickReactionBar = ({ visible, className }) => {
  const { sendReaction } = useRoom();
  const [localVisible, setLocalVisible] = useState(false);
  
  const emojis = ['👍', '❤️', '😂', '🔥', '👏', '😮', '💀', '🎉'];

  useEffect(() => {
    const handler = (e) => setLocalVisible(e.detail);
    window.addEventListener('video:controls-visibility', handler);
    return () => window.removeEventListener('video:controls-visibility', handler);
  }, []);

  const isVisible = visible !== undefined ? visible : localVisible;

  if (!isVisible) return null;

  return (
    <div className={`absolute z-50 animate-slide-up ${className || 'bottom-20 left-1/2 -translate-x-1/2'}`}>
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
