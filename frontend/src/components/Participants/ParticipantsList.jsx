import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import { getInitials, getAvatarColor } from '../../utils/helpers';
import { Crown, Wifi, WifiOff, Loader2, Mic, MicOff } from 'lucide-react';

const ParticipantsList = () => {
  const { participants, voiceParticipants, room } = useRoom();
  const { user } = useAuth();

  const onlineCount = participants.filter((p) => p.isOnline !== false).length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-border-dark flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-text-primary">Participants</h3>
        <span className="badge bg-accent-green/10 text-accent-green">
          {onlineCount} online
        </span>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto scroll-area px-2 py-2">
        {participants.map((p) => {
          const isMe = p.userId === user?.id;
          const isRoomHost = p.userId === room?.hostId;
          const isInVoice = voiceParticipants.some((vp) => vp.userId === p.userId);
          const voiceData = voiceParticipants.find((vp) => vp.userId === p.userId);
          const avatarBg = p.avatar || getAvatarColor(p.username);
          const isOnline = p.isOnline !== false;

          return (
            <div key={p.userId} className="participant-row">
              {/* Avatar with online dot */}
              <div className="relative shrink-0">
                <div className="avatar w-9 h-9 text-sm text-white" style={{ backgroundColor: avatarBg }}>
                  {getInitials(p.username)}
                </div>
                <span
                  className={`status-dot absolute -bottom-0.5 -right-0.5 border-2 border-bg-card
                    ${isOnline ? 'bg-accent-green' : 'bg-text-muted'}`}
                />
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-sm font-medium truncate ${isMe ? 'text-accent-purple' : 'text-text-primary'}`}>
                    {p.username}{isMe ? ' (you)' : ''}
                  </span>
                  {isRoomHost && (
                    <Crown className="w-3.5 h-3.5 text-accent-yellow shrink-0" title="Host" />
                  )}
                  {p.isGuest && (
                    <span className="badge bg-bg-hover text-text-muted text-[9px] px-1.5 py-0">Guest</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {/* Online/offline */}
                  <span className={`text-[10px] ${isOnline ? 'text-accent-green' : 'text-text-muted'}`}>
                    {isOnline ? 'Online' : 'Reconnecting…'}
                  </span>
                  {/* Buffering indicator */}
                  {p.isBuffering && (
                    <span className="flex items-center gap-1 text-[10px] text-accent-yellow">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Buffering
                    </span>
                  )}
                </div>
              </div>

              {/* Voice indicators */}
              {isInVoice && (
                <div className="shrink-0">
                  {voiceData?.isMuted
                    ? <MicOff className="w-3.5 h-3.5 text-text-muted" />
                    : <Mic className="w-3.5 h-3.5 text-accent-green animate-pulse" />}
                </div>
              )}
            </div>
          );
        })}

        {participants.length === 0 && (
          <p className="text-center text-text-muted text-sm py-8">No participants yet</p>
        )}
      </div>
    </div>
  );
};

export default ParticipantsList;
