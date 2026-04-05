'use client';

import { Zap, UserPlus, PlayCircle, Anchor, Info } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

const ActivityFeed = () => {
  const { messages } = useRoom();
  
  // Filter for system messages only
  const systemMessages = messages.filter(m => m.type === 'system');

  if (systemMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 opacity-60">
        <div className="w-16 h-16 bg-gradient-to-br from-obsidian-primary/15 to-obsidian-primary/8 rounded-2xl flex items-center justify-center">
          <Zap className="w-8 h-8 text-obsidian-primary" />
        </div>
        <p className="text-sm font-medium text-obsidian-on-surface-variant">No activity yet. Invite friends to start the party!</p>
      </div>
    );
  }

  const getIcon = (content) => {
    if (content.includes('joined')) return <UserPlus className="w-4 h-4 text-emerald-400" />;
    if (content.includes('left')) return <Zap className="w-4 h-4 text-obsidian-on-surface-variant" />;
    if (content.includes('paused') || content.includes('resumed') || content.includes('jumped')) 
      return <PlayCircle className="w-4 h-4 text-obsidian-tertiary" />;
    if (content.includes('host')) return <Anchor className="w-4 h-4 text-amber-400" />;
    return <Info className="w-4 h-4 text-obsidian-primary" />;
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-area p-4 space-y-3 min-h-0">
      {systemMessages.map((m) => (
        <div key={m.id} className="flex gap-3 animate-fade-in p-2.5 rounded-lg hover:bg-obsidian-primary/8 transition-colors duration-200">
          <div className="mt-0.5 shrink-0 w-6 h-6 flex items-center justify-center bg-obsidian-primary/15 rounded-md">
            {getIcon(m.content)}
          </div>
          <div className="flex-1 space-y-0.5 min-w-0">
            <p className="text-xs font-medium text-obsidian-on-surface leading-tight">
              {m.content}
            </p>
            <span className="text-[9px] text-obsidian-on-surface-variant font-mono uppercase tracking-wider">
              {new Date(m.createdAt || m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;
