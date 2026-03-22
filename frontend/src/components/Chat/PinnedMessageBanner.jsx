import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';

export default function PinnedMessageBanner({ pinnedMessage, onUnpin }) {
  const { user } = useAuth();
  const { room } = useRoom();

  const isHost = room?.hostId === user?.id;
  const isCoHost = room?.coHosts?.includes(user?.id);
  const canUnpin = isHost || isCoHost;

  return (
    <AnimatePresence>
      {pinnedMessage && (
        <Motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="bg-accent-yellow/5 border-b border-accent-yellow/20 p-3 flex items-start gap-3 relative z-10 backdrop-blur-xl group/pin"
        >
          <div className="mt-1 w-8 h-8 rounded-xl bg-accent-yellow/20 flex items-center justify-center border border-accent-yellow/30 shrink-0">
            <svg className="w-4 h-4 text-accent-yellow" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-[10px] text-accent-yellow font-black uppercase tracking-widest mb-1 opacity-80">
              Pinned by Host
            </p>
            <p className="text-sm text-text-primary leading-relaxed line-clamp-2">
              <span className="font-bold text-accent-yellow/90 mr-1.5">{pinnedMessage.username}:</span>
              {pinnedMessage.content}
            </p>
          </div>
          {canUnpin && (
            <button 
              onClick={onUnpin}
              className="absolute right-2 top-2 p-1.5 text-text-muted hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all opacity-0 group-hover/pin:opacity-100"
              title="Unpin message"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
