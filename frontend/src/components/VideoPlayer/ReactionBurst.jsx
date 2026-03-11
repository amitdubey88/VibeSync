import { useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext';

const ReactionBurst = () => {
  const { reactions } = useRoom();
  const [localReactions, setLocalReactions] = useState([]);

  useEffect(() => {
    if (reactions.length > 0) {
      const newReactions = reactions.filter(r => !localReactions.find(lr => lr.id === r.id));
      if (newReactions.length > 0) {
        const isStorm = newReactions.length > 4;
        
        // Pre-compute random position/delay at spawn time so they don't thrash on re-render
        const withPos = (r, suffix = '') => ({
          ...r,
          id: suffix ? `${r.id}${suffix}` : r.id,
          left: 50 + (Math.random() * 40 - 20),
          delay: Math.random() * (isStorm ? 0.4 : 0.2),
        });

        const reactionsToSpawn = isStorm
          ? [
              ...newReactions.map(r => withPos(r)),
              ...Array(15).fill(0).map((_, i) => withPos(newReactions[i % newReactions.length], `-storm-${i}`))
            ]
          : newReactions.map(r => withPos(r));

        setLocalReactions(prev => [...prev, ...reactionsToSpawn]);
        
        reactionsToSpawn.forEach(r => {
          setTimeout(() => {
            setLocalReactions(prev => prev.filter(lr => lr.id !== r.id));
          }, 3500);
        });
      }
    }
  }, [reactions]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {localReactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 text-4xl animate-reaction-rise"
          style={{
            left: `${r.left ?? 50}%`,
            animationDelay: `${r.delay ?? 0}s`
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
};

export default ReactionBurst;
