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
        // SPREAD: Randomly distribute across 20-80% of the screen width
        const withPos = (r, suffix = '') => ({
          ...r,
          id: suffix ? `${r.id}${suffix}` : r.id,
          left: 20 + (Math.random() * 60), 
          delay: Math.random() * (isStorm ? 0.4 : 0.2),
        });

        const reactionsToSpawn = isStorm
          ? [
              ...newReactions.map(r => withPos(r)),
              ...Array(15).fill(0).map((_, i) => withPos(newReactions[i % newReactions.length], `-storm-${i}`))
            ]
          : newReactions.map(r => withPos(r));

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalReactions(prev => [...prev, ...reactionsToSpawn]);
        
        reactionsToSpawn.forEach(r => {
          setTimeout(() => {
            setLocalReactions(prev => prev.filter(lr => lr.id !== r.id));
          }, 3500);
        });
      }
    }
  }, [reactions, localReactions]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {localReactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-20 text-4xl animate-reaction-rise filter drop-shadow-[0_0_20px_rgba(217,70,239,0.7)]"
          style={{
            left: `${r.left ?? 50}%`,
            animationDelay: `${r.delay ?? 0}s`,
            transform: 'translateX(-50%)'
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
};

export default ReactionBurst;
