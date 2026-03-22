import { useWebRTCContext } from '../../context/WebRTCContext';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

/**
 * VoiceControls — uses btn-state-danger / btn-state-success design tokens
 * instead of one-off inline className strings.
 */
const VoiceControls = () => {
  const {
    isInVoice, isMuted, voiceError, toggleMute,
  } = useWebRTCContext();
  const { isHost, muteAllParticipants } = useRoom();

  return (
    <div className="px-2 py-1.5 md:px-4 md:py-3 border-t border-white/5 shrink-0 bg-black/40 backdrop-blur-md">
      <div className="hidden md:flex items-center justify-between mb-2.5">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-headline">
          Voice Chat
        </span>
      </div>

      {voiceError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 mb-3 border border-red-400/20">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {voiceError}
        </div>
      )}

      <div className="flex gap-2">
        {/* Mute toggle — uses explicit cinematic tailwind classes */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all font-bold tracking-wide
            ${isMuted 
              ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.15)]' 
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]'}`}
        >
          {isMuted
            ? <><MicOff className="w-4 h-4" /> Unmute</>
            : <><Mic className="w-4 h-4" /> Mute</>}
        </button>

        {/* Host-only: Mute All */}
        {isHost && isInVoice && (
          <button
            onClick={muteAllParticipants}
            title="Mute Everyone"
            className="
              flex items-center justify-center gap-1.5 px-3
              rounded-xl text-xs font-bold font-headline tracking-wide
              bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20
              hover:bg-fuchsia-500/20 transition-all duration-150 shadow-[0_0_10px_rgba(217,70,239,0.15)] active:scale-[0.97]
            "
          >
            <MicOff className="w-3.5 h-3.5" />
            Mute All
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceControls;
