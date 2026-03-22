import { useWebRTCContext } from '../../context/WebRTCContext';
import { Mic, MicOff } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

/**
 * VoiceControls — uses btn-state-danger / btn-state-success design tokens
 * instead of one-off inline className strings.
 */
const VoiceControls = () => {
  const {
    isMuted, toggleMute,
  } = useWebRTCContext();
  const { isHost, muteAllParticipants } = useRoom();

  return (
    <div className="px-4 py-4 border-t border-white/5 shrink-0 bg-[#0a0a0b]">
      <div className="flex gap-2">
        <button
          onClick={toggleMute}
          className={`flex-1 flex items-center justify-center gap-3 py-4 transition-all font-black uppercase tracking-[0.2em] text-[11px] ${
            isMuted 
              ? "bg-[#1a1313] text-red-500 border border-red-500/30 hover:bg-[#251818]" 
              : "bg-[#131a13] text-emerald-500 border border-emerald-500/30 hover:bg-[#182518]"
          }`}
        >
          {isMuted ? (
            <>
              <MicOff className="w-5 h-5" fill="currentColor" />
              Unmute
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" fill="currentColor" />
              Mute
            </>
          )}
        </button>

        {isHost && (
          <button
            onClick={muteAllParticipants}
            className="flex items-center justify-center gap-2 px-4 bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest h-auto"
          >
            <MicOff className="w-4 h-4" fill="currentColor" />
            <span className="hidden xl:inline">Mute All</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceControls;
