import { useRoom } from '../../context/RoomContext';
import { getInitials, getAvatarColor } from '../../utils/helpers';
import { Users, Crown } from 'lucide-react';

const VideoPresenceOverlay = ({ visible }) => {
  const { participants, voiceParticipants, reactions } = useRoom();

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
    <div className={`absolute top-4 left-4 z-40 flex flex-col gap-3 pointer-events-none transition-opacity duration-500 ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Top Row: Viewer Count & Sync/Status (Simplified) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xl pointer-events-auto">
          <Users className="w-3 h-3 text-accent-purple" />
          <span>{onlineCount} watching</span>
        </div>
      </div>

      {/* Collective Reactions Counter */}
      {Object.entries(reactionCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 animate-bounce">
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <div key={emoji} className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/20 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-lg pointer-events-auto">
              <span>{emoji}</span>
              <span className="text-accent-purple">x{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Avatar Stack Overlay */}
      <div className="flex items-center -space-x-2 pointer-events-auto">
        {activeParticipants.map((p, idx) => {
          const voiceData = voiceParticipants.find(vp => vp.userId === p.userId);
          const isSpeaking = voiceData && !voiceData.isMuted;
          
          return (
            <div 
              key={p.userId} 
              className={`relative flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold text-white shadow-2xl border-2 border-bg-card transition-all hover:z-10 hover:-translate-y-1 group
                ${isSpeaking ? 'ring-2 ring-accent-green trigger-pulse-ring' : ''}`}
              style={{ backgroundColor: p.avatar || getAvatarColor(p.username), zIndex: 10 - idx }}
              title={p.username}
            >
              {getInitials(p.username)}
              
              {/* Speaking Indicator Dot */}
              {isSpeaking && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-green rounded-full border border-bg-card animate-pulse" />
              )}

              {/* Host Crown Indicator */}
              {p.userId === room?.hostId && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]">
                  <Crown className="w-3.5 h-3.5 text-accent-yellow fill-accent-yellow" />
                </div>
              )}

              {/* Tooltip */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {p.username}
              </div>
            </div>
          );
        })}
        {onlineCount > activeParticipants.length && (
          <div className="w-8 h-8 rounded-full bg-bg-hover border-2 border-bg-card flex items-center justify-center text-[10px] font-black text-text-muted z-0">
            +{onlineCount - activeParticipants.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPresenceOverlay;
