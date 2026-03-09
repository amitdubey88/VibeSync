import useWebRTC from '../../hooks/useWebRTC';
import { Mic, MicOff, PhoneCall, PhoneOff, AlertCircle } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';

const VoiceControls = () => {
  const { 
    isInVoice, isMuted, voiceError, joinVoice, leaveVoice, toggleMute
  } = useWebRTC();
  const { room, voiceParticipants, isHost, muteAllParticipants } = useRoom();

  return (
    <div className="px-4 py-3 border-t border-border-dark">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Voice Chat</span>
      </div>

      {voiceError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {voiceError}
        </div>
      )}

      <div className="flex gap-2">
        {/* Mute toggle as primary button */}
        <button
          onClick={toggleMute}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200
            ${isMuted
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
              : 'bg-accent-green/10 text-accent-green hover:bg-accent-green/20 border border-accent-green/30'
            }`}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMuted ? <><MicOff className="w-4 h-4" /> Unmute</> : <><Mic className="w-4 h-4" /> Mute</>}
        </button>

        {/* Mute All (only for host) */}
        {isHost && isInVoice && (
          <button
            onClick={muteAllParticipants}
            className="flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-accent-purple/10 text-accent-purple border border-accent-purple/30 hover:bg-accent-purple/20 transition-all duration-200"
            title="Mute Everyone Else"
          >
            <MicOff className="w-3.5 h-3.5" /> Mute All
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceControls;
