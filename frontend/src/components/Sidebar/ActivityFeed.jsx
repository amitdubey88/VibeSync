import { Zap, UserPlus, PlayCircle, Anchor, Info } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

const ActivityFeed = () => {
  const { messages } = useRoom();
  
  // Filter for system messages only
  const systemMessages = messages.filter(m => m.type === 'system');

  if (systemMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 opacity-50">
        <Zap className="w-12 h-12 text-fuchsia-500" />
        <p className="text-sm font-medium text-zinc-400">No activity yet. Invite friends to start the party!</p>
      </div>
    );
  }

  const getIcon = (content) => {
    if (content.includes('joined')) return <UserPlus className="w-3.5 h-3.5 text-emerald-400" />;
    if (content.includes('left')) return <Zap className="w-3.5 h-3.5 text-zinc-500" />;
    if (content.includes('paused') || content.includes('resumed') || content.includes('jumped')) 
      return <PlayCircle className="w-3.5 h-3.5 text-violet-500" />;
    if (content.includes('host')) return <Anchor className="w-3.5 h-3.5 text-amber-400" />;
    return <Info className="w-3.5 h-3.5 text-fuchsia-500" />;
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-area p-4 space-y-4 min-h-0">
      {systemMessages.map((m) => (
        <div key={m.id} className="flex gap-3 animate-fade-in">
          <div className="mt-0.5 shrink-0">
            {getIcon(m.content)}
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-medium text-zinc-200 leading-tight">
              {m.content}
            </p>
            <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">
              {new Date(m.createdAt || m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;
