import { useState, useEffect, useCallback, useRef } from 'react';
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

// A single floating emoji that rises and fades
const FloatingReaction = ({ emoji, x, id, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="absolute pointer-events-none select-none animate-reaction-rise"
      style={{ left: `${x}%`, bottom: '0%', fontSize: '2rem' }}
    >
      {emoji}
    </div>
  );
};

const VideoReactionBar = ({ visible: visibleProp }) => {
  const { sendReaction, reactions } = useRoom();
  const [floaters, setFloaters] = useState([]);
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

  const processedIdsRef = useRef(new Set());

  // Convert incoming room reactions to floaters
  useEffect(() => {
    if (!reactions.length) return;

    setFloaters(prev => {
      const newFloaters = [];
      reactions.forEach(r => {
        const id = r.id || `${r.timestamp}-${r.username}`;
        if (!processedIdsRef.current.has(id)) {
          processedIdsRef.current.add(id);
          newFloaters.push({
            id,
            emoji: r.emoji,
            x: 10 + Math.random() * 80
          });
        }
      });

      if (newFloaters.length === 0) return prev;
      return [...prev, ...newFloaters];
    });

    // Cleanup old IDs periodically if the array gets too long
    if (processedIdsRef.current.size > 200) {
      const currentIds = new Set(reactions.map(r => r.id || `${r.timestamp}-${r.username}`));
      processedIdsRef.current.forEach(id => {
        if (!currentIds.has(id)) processedIdsRef.current.delete(id);
      });
    }
  }, [reactions]);

  const removeFloater = useCallback((id) => {
    setFloaters(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleReact = (emoji) => {
    sendReaction(emoji);
  };

  return (
    <>
      {/* Floating emojis rendered over the video */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {floaters.map(f => (
          <FloatingReaction
            key={f.id}
            id={f.id}
            emoji={f.emoji}
            x={f.x}
            onDone={() => removeFloater(f.id)}
          />
        ))}
      </div>

      {/* Reaction button bar - Teams style, auto-hides/shows on interaction */}
      <div
        className={`absolute bottom-16 left-1/2 -translate-x-1/2 z-30 transition-all duration-300
          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
          portrait:hidden`}
      >
        <div className="flex flex-wrap justify-center items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl sm:rounded-full px-3 py-2 shadow-2xl max-w-[90vw] sm:max-w-none">
          {REACTIONS.map(({ emoji, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleReact(emoji)}
              title={label}
              className="relative group w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/15 transition-all duration-150 hover:scale-125 active:scale-100"
            >
              <span className="text-xl leading-none">{emoji}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default VideoReactionBar;
