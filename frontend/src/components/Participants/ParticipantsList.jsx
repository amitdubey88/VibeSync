import { useState, useRef, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import { useCoHost } from '../../hooks/useCoHost';
import { getAvatarColor } from '../../utils/helpers';
import { 
  CrownIcon, MicIcon, MicOffIcon, MoreIcon, 
  CheckIcon, VolumeMutedIcon, ExitIcon, StarIcon 
} from '../UI/SharpIcons';
import ConfirmDialog from '../UI/ConfirmDialog';
import Avatar from '../UI/Avatar';

const ParticipantsList = () => {
  const { participants, voiceParticipants, room, isHost, transferHost, kickParticipant, muteParticipant } = useRoom();
  const { user } = useAuth();
  const { coHosts, assignCoHost, removeCoHost } = useCoHost();
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
    promoteCoHost: {
      title: 'Make Co-Host?',
      message: `${confirm?.username} will be able to moderate the room.`,
      confirmLabel: 'Promote',
      danger: false,
      onConfirm: () => assignCoHost(confirm.userId),
    },
    demoteCoHost: {
      title: 'Remove Co-Host?',
      message: `${confirm?.username} will lose moderation privileges.`,
      confirmLabel: 'Demote',
      danger: false,
      onConfirm: () => removeCoHost(confirm.userId),
    },
  };

  const activeConfirm = confirm ? confirmProps[confirm.type] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-obsidian-primary/15 bg-gradient-to-r from-obsidian-surface/50 to-obsidian-surface/30 backdrop-blur-md flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-obsidian-on-surface font-headline tracking-wider">Participants</h3>
        <span className="badge bg-gradient-to-r from-emerald-500/15 to-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]">{onlineCount} online</span>
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
              <Avatar
                username={p.username}
                avatarBg={avatarBg}
                size="md"
                status={p.status === 'away' ? 'away' : isOnline ? (p.isBuffering ? 'buffering' : 'online') : 'offline'}
                speaking={isSpeaking}
              />

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-sm tracking-wide font-headline truncate ${isMe ? 'text-obsidian-primary font-bold' : 'text-obsidian-on-surface font-semibold'}`}>
                    {p.username}{isMe ? ' (you)' : ''}
                  </span>
                  {isRoomHost && <CrownIcon size={14} className="text-amber-500 drop-shadow-[0_0_4px_rgba(217,119,6,0.5)] shrink-0" />}
                  {coHosts.includes(p.userId) && !isRoomHost && <StarIcon size={14} className="text-obsidian-primary drop-shadow-[0_0_4px_rgba(170,85,255,0.4)] shrink-0" />}
                  {p.isGuest && <span className="badge bg-obsidian-tertiary/15 text-obsidian-tertiary border border-obsidian-tertiary/30 text-[9px] px-1.5 py-0.5 rounded-full">Guest</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {p.status === 'away' ? (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium tracking-wide">
                      💤 Away
                    </span>
                  ) : !isOnline ? (
                    <span className="flex items-center gap-1 text-[10px] text-red-500/80 font-medium tracking-wide">
                      🔴 Offline
                    </span>
                  ) : p.isBuffering ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium tracking-wide animate-pulse">
                      🟡 Buffering
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium tracking-wide">
                      🟢 Watching
                    </span>
                  )}
                </div>
              </div>

              {/* Voice indicator */}
              {isInVoice && (
                <div className="shrink-0 mr-1">
                  {voiceData?.isMuted
                    ? <MicOffIcon size={14} className="text-red-500" />
                    : <MicIcon size={14} className="text-emerald-400 animate-pulse" />}
                </div>
              )}

              {/* Host controls ⋮ */}
              {canControl && (
                <div className="relative shrink-0 ml-1" ref={openMenuId === p.userId ? menuRef : null}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === p.userId ? null : p.userId)}
                    className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <MoreIcon size={16} />
                  </button>

                  {openMenuId === p.userId && (
                    <div className="absolute right-0 top-8 z-50 w-48 bg-[#0e0e0f]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                      <button
                        onClick={() => { setConfirm({ type: 'makeHost', userId: p.userId, username: p.username }); setOpenMenuId(null); }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-[11px] font-headline uppercase tracking-widest text-zinc-400 hover:bg-white/5 hover:text-amber-400 transition-colors"
                      >
                        <CheckIcon size={14} className="text-amber-400" /> Make Host
                      </button>
                      
                      {coHosts.includes(p.userId) ? (
                        <button
                          onClick={() => { setConfirm({ type: 'demoteCoHost', userId: p.userId, username: p.username }); setOpenMenuId(null); }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-[11px] font-headline uppercase tracking-widest text-zinc-400 hover:bg-white/5 hover:text-fuchsia-400 transition-colors"
                        >
                          <StarIcon size={14} className="text-fuchsia-400" /> Remove Co-host
                        </button>
                      ) : (
                        <button
                          onClick={() => { setConfirm({ type: 'promoteCoHost', userId: p.userId, username: p.username }); setOpenMenuId(null); }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-[11px] font-headline uppercase tracking-widest text-zinc-400 hover:bg-white/5 hover:text-fuchsia-400 transition-colors"
                        >
                          <StarIcon size={14} className="text-fuchsia-400" /> Make Co-host
                        </button>
                      )}
                      <button
                        onClick={() => { setConfirm({ type: 'mute', userId: p.userId, username: p.username }); setOpenMenuId(null); }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-[11px] font-headline uppercase tracking-widest text-zinc-400 hover:bg-white/5 hover:text-fuchsia-400 transition-colors"
                      >
                        <VolumeMutedIcon size={14} className="text-fuchsia-400" /> Mute
                      </button>
                      <div className="border-t border-white/10" />
                      <button
                        onClick={() => { setConfirm({ type: 'kick', userId: p.userId, username: p.username }); setOpenMenuId(null); }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-[11px] font-headline uppercase tracking-widest text-red-500 hover:bg-red-500/10 font-bold transition-all transition-colors duration-200"
                      >
                        <ExitIcon size={14} /> Remove from Room
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {participants.length === 0 && (
          <p className="text-center text-zinc-500 text-sm py-8 font-headline tracking-wide">No participants yet</p>
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
