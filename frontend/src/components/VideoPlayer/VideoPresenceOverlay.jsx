'use client';

import { useRoom } from '../../context/RoomContext';
import { getInitials, getAvatarColor } from '../../utils/helpers';
import { Users, Crown } from 'lucide-react';

const VideoPresenceOverlay = ({ visible }) => {
  const { room, participants, voiceParticipants, reactions } = useRoom();

  const onlineCount = participants.filter(p => p.isOnline !== false).length;

  // Aggregate current reactions for the collective counter
  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const activeParticipants = [...participants]
    .filter(p => p.isOnline !== false)
    .sort((a, b) => {
      const aVoice = voiceParticipants.find(vp => vp.userId === a.userId);
      const bVoice = voiceParticipants.find(vp => vp.userId === b.userId);
      const aSpeaking = aVoice && !aVoice.isMuted;
      const bSpeaking = bVoice && !bVoice.isMuted;
      
      if (aSpeaking && !bSpeaking) return -1;
      if (!aSpeaking && bSpeaking) return 1;
      return 0;
    })
    .slice(0, 4);

  return (
    <div className={`absolute top-6 left-6 z-40 flex flex-col gap-4 pointer-events-none transition-all duration-500 ease-in-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
      {/* Top Row: Viewer Count */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-obsidian-bg/40 backdrop-blur-xl border border-white/5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] text-white shadow-2xl pointer-events-auto">
          <Users className="w-3.5 h-3.5 text-obsidian-primary" />
          <span>{onlineCount} watching</span>
        </div>
      </div>

      {/* Collective Reactions Counter */}
      {Object.entries(reactionCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 animate-bounce">
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <div key={emoji} className="flex items-center gap-2 bg-obsidian-bg/40 backdrop-blur-xl border border-white/10 px-3 py-1 rounded-full text-xs font-black text-white shadow-xl pointer-events-auto">
              <span>{emoji}</span>
              <span className="text-obsidian-primary font-black">x{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Avatar Stack Overlay */}
      <div className="flex items-center -space-x-3 pointer-events-auto pl-1">
        {activeParticipants.map((p, idx) => {
          const voiceData = voiceParticipants.find(vp => vp.userId === p.userId);
          const isSpeaking = voiceData && !voiceData.isMuted;
          
          return (
            <div 
              key={p.userId} 
              className={`relative flex items-center justify-center w-9 h-9 rounded-full text-[11px] font-black text-white shadow-2xl border-2 border-obsidian-bg/80 transition-all hover:z-20 hover:-translate-y-1 hover:scale-110 group
                ${isSpeaking ? 'ring-2 ring-obsidian-primary ring-offset-2 ring-offset-transparent' : ''}`}
              style={{ backgroundColor: p.avatar || getAvatarColor(p.username), zIndex: 10 - idx }}
            >
              {getInitials(p.username)}
              
              {/* Speaking Indicator Dot */}
              {isSpeaking && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-obsidian-bg animate-pulse" />
              )}

              {/* Host Crown Indicator */}
              {p.userId === room?.hostId && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
              )}

              {/* Tooltip */}
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-obsidian-bg/90 backdrop-blur-md border border-white/5 text-[9px] font-bold px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl">
                {p.username}
              </div>
            </div>
          );
        })}
        {onlineCount > activeParticipants.length && (
          <div className="w-9 h-9 rounded-full bg-white/5 backdrop-blur-md border-2 border-obsidian-bg/80 flex items-center justify-center text-[10px] font-black text-white/40 z-0">
            +{onlineCount - activeParticipants.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPresenceOverlay;
