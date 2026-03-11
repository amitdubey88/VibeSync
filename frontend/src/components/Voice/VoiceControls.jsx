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
    <div className="px-4 py-3 border-t border-border-dark">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
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
        {/* Mute toggle — uses shared btn-state-danger / btn-state-success classes */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          className={`flex-1 py-2 px-3 ${isMuted ? 'btn-state-danger' : 'btn-state-success'}`}
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
              rounded-lg text-xs font-semibold
              bg-accent-purple/10 text-accent-purple border border-accent-purple/30
              hover:bg-accent-purple/20 transition-all duration-150 active:scale-[0.97]
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
