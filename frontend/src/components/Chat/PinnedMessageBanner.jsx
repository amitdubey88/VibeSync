'use client';

import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { PinIcon, XIcon } from '../UI/SharpIcons';

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
          className="bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-3xl shadow-[0_4px_20px_rgba(245,158,11,0.05)] p-3 flex items-start gap-3 relative z-10 backdrop-blur-xl group/pin"
        >
          <div className="mt-1 w-8 h-8 bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0">
            <PinIcon size={16} className="text-amber-400" fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-1 opacity-80">
              Pinned by Host
            </p>
            <p className="text-sm text-zinc-200 font-headline tracking-wide leading-relaxed line-clamp-2">
              <span className="font-bold text-amber-400/90 mr-1.5">{pinnedMessage.username}:</span>
              {pinnedMessage.content}
            </p>
          </div>
          {canUnpin && (
            <button 
              onClick={onUnpin}
              className="absolute right-2 top-2 p-1.5 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 transition-all opacity-0 group-hover/pin:opacity-100"
              title="Unpin message"
            >
              <XIcon size={14} />
            </button>
          )}
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
