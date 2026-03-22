import { Zap, UserPlus, PlayCircle, Anchor, Info } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

const ActivityFeed = () => {
  const { messages } = useRoom();
  
  // Filter for system messages only
  const systemMessages = messages.filter(m => m.type === 'system');

  if (systemMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 opacity-50">
        <Zap className="w-12 h-12 text-accent-purple" />
        <p className="text-sm font-medium">No activity yet. Invite friends to start the party!</p>
      </div>
    );
  }

  const getIcon = (content) => {
    if (content.includes('joined')) return <UserPlus className="w-3.5 h-3.5 text-accent-green" />;
    if (content.includes('left')) return <Zap className="w-3.5 h-3.5 text-text-muted" />;
    if (content.includes('paused') || content.includes('resumed') || content.includes('jumped')) 
      return <PlayCircle className="w-3.5 h-3.5 text-accent-red" />;
    if (content.includes('host')) return <Anchor className="w-3.5 h-3.5 text-accent-yellow" />;
    return <Info className="w-3.5 h-3.5 text-accent-purple" />;
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-area p-4 space-y-4">
      {systemMessages.map((m) => (
        <div key={m.id} className="flex gap-3 animate-fade-in">
          <div className="mt-0.5 shrink-0">
            {getIcon(m.content)}
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-medium text-text-primary leading-tight">
              {m.content}
            </p>
            <span className="text-[9px] text-text-muted font-mono uppercase">
              {new Date(m.createdAt || m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;
