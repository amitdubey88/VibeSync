import { useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext';

const ReactionBurst = () => {
  const { reactions } = useRoom();
  const [localReactions, setLocalReactions] = useState([]);

  useEffect(() => {
    if (reactions.length > 0) {
      const newReactions = reactions.filter(r => !localReactions.find(lr => lr.id === r.id));
      if (newReactions.length > 0) {
        // Check for Reaction Storm (Hype Mode)
        // If > 5 reactions arrive in a tiny window, we amplify the effect
        const isStorm = newReactions.length > 4;
        
        const reactionsToSpawn = isStorm 
          ? [...newReactions, ...Array(15).fill(0).map((_, i) => ({ 
              ...newReactions[i % newReactions.length], 
              id: `${newReactions[0].id}-storm-${i}` 
            }))]
          : newReactions;

        setLocalReactions(prev => [...prev, ...reactionsToSpawn]);
        
        // Remove reaction after animation duration
        reactionsToSpawn.forEach(r => {
          setTimeout(() => {
            setLocalReactions(prev => prev.filter(lr => lr.id !== r.id));
          }, 3000);
        });
      }
    }
  }, [reactions]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {localReactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 text-4xl animate-float-up opacity-0"
          style={{
            left: `${50 + (Math.random() * 40 - 20)}%`, // Random horizontal spread
            animationDelay: `${Math.random() * 0.2}s`
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
};

export default ReactionBurst;
