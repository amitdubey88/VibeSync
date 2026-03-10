import { useRoom } from '../../context/RoomContext';

const EnergyMeter = () => {
  const { energy } = useRoom();
  
  // Decide how many fires to show based on energy
  const level = Math.floor(energy / 20); // 0-5 levels
  const flames = Array(5).fill(0).map((_, i) => i < level);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {flames.map((isLit, i) => (
          <span 
            key={i} 
            className={`text-sm transition-all duration-500 transform ${isLit ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'opacity-20 grayscale scale-90'}`}
          >
            🔥
          </span>
        ))}
      </div>
      <span className="text-[8px] font-black uppercase text-text-muted tracking-widest">Room Energy</span>
    </div>
  );
};

export default EnergyMeter;
