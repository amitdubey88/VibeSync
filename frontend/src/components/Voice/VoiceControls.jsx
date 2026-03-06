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
        {isInVoice && (
          <span className="badge bg-accent-green/10 text-accent-green text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse inline-block mr-1" />
            {voiceParticipants.length} in voice
          </span>
        )}
      </div>

      {voiceError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {voiceError}
        </div>
      )}

      <div className="flex gap-2">
        {/* Join / Leave */}
        <button
          onClick={isInVoice ? leaveVoice : joinVoice}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200
            ${isInVoice
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
              : 'bg-accent-green/10 text-accent-green hover:bg-accent-green/20 border border-accent-green/30'
            }`}
        >
          {isInVoice ? (
            <><PhoneOff className="w-4 h-4" /> Leave</>
          ) : (
             <><PhoneCall className="w-4 h-4" /> Join Voice</>
          )}
        </button>

        {/* Mute toggle (only when in call) */}
        {isInVoice && (
          <button
            onClick={toggleMute}
            className={`btn-icon w-10 h-10 rounded-lg border transition-all duration-200
              ${isMuted
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : 'bg-bg-hover text-text-secondary border-border-light hover:text-text-primary'
              }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* Mute All (only for host, when in call) */}
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
