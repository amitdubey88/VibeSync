import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mx-3 mt-2 mb-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 shadow-sm flex items-start gap-2 relative z-10"
        >
          <div className="mt-0.5 text-yellow-500">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[10px] text-yellow-500/70 font-bold uppercase tracking-wider mb-0.5">
              Pinned Message
            </p>
            <p className="text-sm text-gray-200 truncate">
              <span className="font-medium opacity-70 mr-1">{pinnedMessage.username}:</span>
              {pinnedMessage.content}
            </p>
          </div>
          {canUnpin && (
            <button 
              onClick={onUnpin}
              className="absolute right-2 top-2 p-1 text-gray-500 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors"
              title="Unpin message"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
