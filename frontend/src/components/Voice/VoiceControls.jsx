import useWebRTC from '../../hooks/useWebRTC';
import { Mic, MicOff, PhoneCall, PhoneOff, AlertCircle, MonitorUp, MonitorX } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';

const VoiceControls = () => {
  const { 
    isInVoice, isMuted, voiceError, joinVoice, leaveVoice, toggleMute,
    isSharingScreen, shareScreen, stopScreenShare, remoteScreens 
  } = useWebRTC();
  const { voiceParticipants, isHost, muteAllParticipants } = useRoom();

  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    // Find the container in RoomPage to render screen shares into
    setPortalContainer(document.getElementById('screen-share-container'));
  }, []);

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

        {/* Share Screen (only when in call) */}
        {isInVoice && (
          <button
            onClick={isSharingScreen ? stopScreenShare : shareScreen}
            className={`btn-icon w-10 h-10 rounded-lg border transition-all duration-200
              ${isSharingScreen
                ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                : 'bg-bg-hover text-text-secondary border-border-light hover:text-text-primary'
              }`}
            title={isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
          >
            {isSharingScreen ? <MonitorX className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
          </button>
        )}

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

        {/* Mute All (only for host, when in call and multiple people) */}
        {isHost && isInVoice && voiceParticipants.length > 1 && (
          <button
            onClick={muteAllParticipants}
            className="flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-accent-purple/10 text-accent-purple border border-accent-purple/30 hover:bg-accent-purple/20 transition-all duration-200"
            title="Mute Everyone Else"
          >
            <MicOff className="w-3.5 h-3.5" /> Mute All
          </button>
        )}
      </div>

      {/* Render Remote Screens via Portal into RoomPage */}
      {portalContainer && Object.keys(remoteScreens).length > 0 && createPortal(
        Object.entries(remoteScreens).map(([socketId, stream]) => {
          const participantName = voiceParticipants.find(p => p.socketId === socketId)?.username || 'Someone';
          return (
            <div key={socketId} className="relative w-64 md:w-80 aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-accent-blue/50 pointer-events-auto group">
              <video
                autoPlay
                playsInline
                ref={(el) => { if (el) el.srcObject = stream; }}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-semibold text-white shadow-sm flex items-center gap-1.5">
                <MonitorUp className="w-3 h-3 text-accent-blue" />
                {participantName}'s Screen
              </div>
            </div>
          );
        }),
        portalContainer
      )}
    </div>
  );
};

export default VoiceControls;
