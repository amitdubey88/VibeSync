'use client';

import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function SlowModeTimer({ remaining, isHost }) {
  if (isHost && remaining === 0) {
    return (
      <span className="absolute -top-6 left-2 px-2 py-0.5 bg-black/80 text-[10px] text-zinc-400  border border-white/10 font-headline uppercase tracking-wider backdrop-blur-md px-3 py-1 pointer-events-none">
        Slow Mode On
      </span>
    );
  }

  return (
    <AnimatePresence>
      {remaining > 0 && typeof remaining === 'number' && (
        <Motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute inset-0 flex items-center justify-center bg-black/80  backdrop-blur-2xl border border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.8)] z-10 pointer-events-none"
        >
          <span className="text-sm font-semibold text-fuchsia-400 tracking-widest font-mono font-bold drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]">
            {remaining}s
          </span>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
