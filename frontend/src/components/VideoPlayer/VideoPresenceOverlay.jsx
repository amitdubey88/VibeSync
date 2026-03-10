import { useRoom } from '../../context/RoomContext';
import { getInitials, getAvatarColor } from '../../utils/helpers';
import { Loader2 } from 'lucide-react';

const VideoPresenceOverlay = ({ visible }) => {
  const { participants, voiceParticipants } = useRoom();

  // Only show top 6 online participants in the overlay to avoid clutter
  const activeParticipants = [...participants]
    .filter(p => p.isOnline !== false)
    .sort((a, b) => {
      // Prioritize speaking users, then buffering users, then others
      const aVoice = voiceParticipants.find(vp => vp.userId === a.userId);
      const bVoice = voiceParticipants.find(vp => vp.userId === b.userId);
      const aSpeaking = aVoice && !aVoice.isMuted;
      const bSpeaking = bVoice && !bVoice.isMuted;
      
      if (aSpeaking && !bSpeaking) return -1;
      if (!aSpeaking && bSpeaking) return 1;
      if (a.isBuffering && !b.isBuffering) return -1;
      if (!a.isBuffering && b.isBuffering) return 1;
      return 0;
    })
    .slice(0, 6);

  if (activeParticipants.length === 0) return null;

  return (
    <div className={`absolute top-4 left-4 z-40 flex flex-col gap-2 transition-opacity duration-300 pointer-events-none ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {activeParticipants.map(p => {
        const voiceData = voiceParticipants.find(vp => vp.userId === p.userId);
        const isSpeaking = voiceData && !voiceData.isMuted;
        
        return (
          <div key={p.userId} className="flex items-center gap-2 animate-fade-in group pointer-events-auto cursor-default">
            <div 
              className={`relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shadow-lg border border-white/20 transition-all ${isSpeaking ? 'ring-2 ring-accent-green trigger-pulse-ring' : ''}`}
              style={{ backgroundColor: p.avatar || getAvatarColor(p.username) }}
              title={p.username}
            >
              {getInitials(p.username)}
              
              {/* Status Badge Overlays */}
              {p.isBuffering ? (
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 bg-bg-panel rounded-full border border-border-dark shadow-sm">
                  <Loader2 className="w-2.5 h-2.5 text-accent-yellow animate-spin" />
                </span>
              ) : p.status === 'away' ? (
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 bg-bg-panel rounded-full border border-border-dark shadow-sm">
                  <span className="text-[8px]">💤</span>
                </span>
              ) : isSpeaking ? (
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 bg-bg-panel rounded-full border border-border-dark shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                </span>
              ) : null}
            </div>
            
            {/* Expanded hover tooltip/name (visible only on hover when controls are active) */}
            <div className={`bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-white truncate max-w-[100px] opacity-0 group-hover:opacity-100 transition-opacity`}>
              {p.username}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VideoPresenceOverlay;
