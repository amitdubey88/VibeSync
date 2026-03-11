import { useState, useRef, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import { getInitials, getAvatarColor } from '../../utils/helpers';
import { Crown, Mic, MicOff, MoreVertical, UserCheck, VolumeX, LogOut } from 'lucide-react';
import ConfirmDialog from '../UI/ConfirmDialog';

const ParticipantsList = () => {
  const { participants, voiceParticipants, room, isHost, transferHost, kickParticipant, muteParticipant, toggleScreenSharePermission } = useRoom();
  const { user } = useAuth();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type, userId, username }
  const menuRef = useRef(null);

  const onlineCount = participants.filter((p) => p.isOnline !== false).length;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Confirm actions ────────────────────────────────────────────────────────
  const confirmProps = {
    makeHost: {
      title: 'Transfer Host?',
      message: `${confirm?.username} will become the new host and gain full control.`,
      confirmLabel: 'Make Host',
      danger: false,
      onConfirm: () => transferHost(confirm.userId),
    },
    mute: {
      title: 'Mute Participant?',
      message: `${confirm?.username}'s microphone will be muted.`,
      confirmLabel: 'Mute',
      danger: false,
      onConfirm: () => muteParticipant(confirm.userId),
    },
    kick: {
      title: 'Remove from Room?',
      message: `${confirm?.username} will be immediately removed from the room.`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: () => kickParticipant(confirm.userId),
    },
  };

  const activeConfirm = confirm ? confirmProps[confirm.type] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-dark flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-text-primary">Participants</h3>
        <span className="badge bg-accent-green/10 text-accent-green">{onlineCount} online</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-area px-2 py-2">
        {participants.map((p) => {
          const isMe = p.userId === user?.id || p.username === user?.username;
          const isRoomHost = p.userId === room?.hostId;
          const isInVoice = voiceParticipants.some((vp) => String(vp.userId) === String(p.userId));
          const voiceData = voiceParticipants.find((vp) => String(vp.userId) === String(p.userId));
          const isSpeaking = voiceData && !voiceData.isMuted;
          const avatarBg = p.avatar || getAvatarColor(p.username);
          const isOnline = p.isOnline !== false;
          const canControl = isHost && !isMe && !isRoomHost;

          return (
            <div key={p.userId} className="participant-row relative animate-participant-enter">
              <div className="relative shrink-0">
                <div 
                  className={`avatar w-9 h-9 text-sm text-white avatar-ring transition-all ${isSpeaking ? 'trigger-pulse-ring ring-2 ring-accent-green' : ''}`} 
                  style={{ backgroundColor: avatarBg }}
                >
                  {getInitials(p.username)}
                </div>
                <span className={`status-dot absolute -bottom-0.5 -right-0.5 border-2 border-bg-card
                  ${p.status === 'away' ? 'bg-accent-yellow' : isOnline ? 'bg-accent-green' : 'bg-text-muted'}`} />
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-sm font-medium truncate ${isMe ? 'text-accent-purple' : 'text-text-primary'}`}>
                    {p.username}{isMe ? ' (you)' : ''}
                  </span>
                  {isRoomHost && <Crown className="w-3.5 h-3.5 text-accent-yellow shrink-0" />}
                  {p.isGuest && <span className="badge bg-bg-hover text-text-muted text-[9px] px-1.5 py-0">Guest</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {p.status === 'away' ? (
                    <span className="flex items-center gap-1 text-[10px] text-text-muted font-medium tracking-wide">
                      💤 Away
                    </span>
                  ) : !isOnline ? (
                    <span className="flex items-center gap-1 text-[10px] text-red-500/80 font-medium tracking-wide">
                      🔴 Offline
                    </span>
                  ) : p.isBuffering ? (
                    <span className="flex items-center gap-1 text-[10px] text-accent-yellow font-medium tracking-wide animate-pulse">
                      🟡 Buffering
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-accent-green font-medium tracking-wide">
                      🟢 Watching
                    </span>
                  )}
                </div>
              </div>

              {/* Voice indicator */}
              {isInVoice && (
                <div className="shrink-0 mr-1">
                  {voiceData?.isMuted
                    ? <MicOff className="w-3.5 h-3.5 text-red-500" />
                    : <Mic className="w-3.5 h-3.5 text-accent-green animate-pulse" />}
                </div>
              )}

              {/* Host controls ⋮ */}
              {canControl && (
                <div className="relative shrink-0 ml-1" ref={openMenuId === p.userId ? menuRef : null}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === p.userId ? null : p.userId)}
                    className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {openMenuId === p.userId && (
                    <div className="absolute right-0 top-8 z-50 w-48 rounded-xl bg-bg-card border border-border-dark shadow-2xl overflow-hidden">
                      <button
                        onClick={() => { setConfirm({ type: 'makeHost', userId: p.userId, username: p.username }); setOpenMenuId(null); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-accent-yellow transition-colors"
                      >
                        <UserCheck className="w-4 h-4 text-accent-yellow" /> Make Host
                      </button>
                      <button
                        onClick={() => { setConfirm({ type: 'mute', userId: p.userId, username: p.username }); setOpenMenuId(null); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-accent-purple transition-colors"
                      >
                        <VolumeX className="w-4 h-4 text-accent-purple" /> Mute
                      </button>
                      <div className="border-t border-border-dark" />
                      <button
                        onClick={() => { setConfirm({ type: 'kick', userId: p.userId, username: p.username }); setOpenMenuId(null); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Remove from Room
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {participants.length === 0 && (
          <p className="text-center text-text-muted text-sm py-8">No participants yet</p>
        )}
      </div>

      {/* Confirmation dialog */}
      {activeConfirm && (
        <ConfirmDialog
          open={!!confirm}
          title={activeConfirm.title}
          message={activeConfirm.message}
          confirmLabel={activeConfirm.confirmLabel}
          danger={activeConfirm.danger}
          onConfirm={activeConfirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default ParticipantsList;
