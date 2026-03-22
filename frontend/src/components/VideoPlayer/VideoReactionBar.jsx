import { useState, useEffect, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';

// Teams-style reaction buttons shown over the video player
const REACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '✋', label: 'Raise Hand' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '💯', label: '100' },
  { emoji: '🤯', label: 'Mind Blown' },
  { emoji: '💀', label: 'Dead' },
  { emoji: '🤡', label: 'Clown' },
  { emoji: '🍿', label: 'Popcorn' },
];

const VideoReactionBar = ({ visible: visibleProp }) => {
  const { sendReaction } = useRoom();
  const [internalVisible, setInternalVisible] = useState(false);
  const hideTimerRef = useRef(null);

  // If visibleProp is provided, we use it. Otherwise we use internalVisible.
  const isVisible = visibleProp !== undefined ? visibleProp : internalVisible;

  // Internal visibility logic (only if prop not used)
  useEffect(() => {
    if (visibleProp !== undefined) return;

    const container = document.querySelector('.video-reaction-host');
    if (!container) return;

    const onEnter = () => {
      setInternalVisible(true);
      clearTimeout(hideTimerRef.current);
    };
    const onLeave = () => {
      hideTimerRef.current = setTimeout(() => setInternalVisible(false), 2000);
    };

    container.addEventListener('mouseenter', onEnter);
    container.addEventListener('mousemove', onEnter);
    container.addEventListener('mouseleave', onLeave);
    container.addEventListener('touchstart', onEnter, { passive: true });

    return () => {
      container.removeEventListener('mouseenter', onEnter);
      container.removeEventListener('mousemove', onEnter);
      container.removeEventListener('mouseleave', onLeave);
      container.removeEventListener('touchstart', onEnter);
      clearTimeout(hideTimerRef.current);
    };
  }, [visibleProp]);

  const handleReact = (emoji) => {
    sendReaction(emoji);
  };

  return (
    <div
      className={`absolute bottom-28 left-1/2 -translate-x-1/2 z-50 transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}
        portrait:hidden`}
    >
      <div className="flex flex-wrap justify-center items-center gap-1 bg-[#0a0a0b]/90 backdrop-blur-3xl border border-white/5 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.9)] max-w-[90vw] sm:max-w-none">
        {REACTIONS.map(({ emoji, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleReact(emoji)}
            title={label}
            className="relative group w-12 h-12 flex items-center justify-center hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 hover:scale-125 active:scale-95 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            <span className="text-2xl leading-none">{emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default VideoReactionBar;
