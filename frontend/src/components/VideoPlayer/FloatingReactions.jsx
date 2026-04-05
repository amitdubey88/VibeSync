'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';

// A single floating emoji that rises and fades
const FloatingReaction = ({ emoji, x, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="absolute pointer-events-none select-none animate-reaction-rise filter drop-shadow-[0_0_20px_rgba(225,29,72,0.7)]"
      style={{ left: `${x}%`, bottom: '0%', fontSize: '2rem' }}
    >
      {emoji}
    </div>
  );
};

const FloatingReactions = () => {
  const { reactions } = useRoom();
  const [floaters, setFloaters] = useState([]);
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

    // Cleanup old IDs periodically
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

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {floaters.map(f => (
        <FloatingReaction
          key={f.id}
          emoji={f.emoji}
          x={f.x}
          onDone={() => removeFloater(f.id)}
        />
      ))}
    </div>
  );
};

export default FloatingReactions;
