import { useRoom } from '../../context/RoomContext';

const EnergyMeter = () => {
  const { energy } = useRoom();
  
  // Decide how many fires to show based on energy
  const level = Math.floor(energy / 20); // 0-5 levels
  const flames = Array(5).fill(0).map((_, i) => i < level);

  return (
    <div className="flex flex-col items-center gap-2 p-2 rounded-lg bg-gradient-to-b from-red-500/8 to-transparent border border-red-500/15">
      <div className="flex gap-1">
        {flames.map((isLit, i) => (
          <span 
            key={i} 
            className={`text-base transition-all cubic-bezier(0.22,1,0.36,1) duration-500 transform ${isLit ? 'opacity-100 scale-125 drop-shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-pulse' : 'opacity-25 grayscale scale-90'}`}
          >
            🔥
          </span>
        ))}
      </div>
      <span className="text-[8px] font-bold uppercase text-red-500/70 font-headline tracking-wider">Energy</span>
    </div>
  );
};

export default EnergyMeter;
