'use client';

import { useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext';

const QuickReactionBar = ({ visible, className, isOverlay }) => {
  const { sendReaction } = useRoom();
  const [localVisible, setLocalVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const emojis = ['👍', '❤️', '😂', '🔥', '👏', '😮', '💀', '🎉'];

  useEffect(() => {
    // Initial check
    setIsFullscreen(!!document.fullscreenElement);
    
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
  let positionClasses = '';
  if (isFullscreen || isOverlay) {
    positionClasses = 'absolute bottom-24 inset-x-0 mx-auto z-[60] w-fit max-w-[90%] flex justify-center px-4';
  } else {
    positionClasses = 'w-full py-2 flex justify-center px-2';
  }

  const buttonSizeClass = isFullscreen 
    ? 'w-10 h-10 text-xl' 
    : (isOverlay ? 'w-12 h-12 text-2xl' : 'w-8 h-8 md:w-10 md:h-10 text-lg md:text-2xl');

  return (
    <div className={`transition-all duration-300 animate-slide-up ${positionClasses} ${className || ''}`}>
      <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-3 p-1.5 md:p-2 bg-obsidian-bg/60 backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-2xl px-3 py-2">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className={`${buttonSizeClass} flex items-center justify-center hover:bg-white/10 transition-all duration-200 hover:-translate-y-1.5 hover:scale-125 active:scale-90 rounded-xl hover:shadow-[0_4px_15px_rgba(255,255,255,0.05)]`}
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
