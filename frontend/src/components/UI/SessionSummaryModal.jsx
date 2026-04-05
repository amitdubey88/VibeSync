'use client';

import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function SessionSummaryModal({ summary, onClose }) {
  if (!summary) return null;

  return (
    <AnimatePresence>
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-3xl"
      >
        <Motion.div
          initial={{ y: 50, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 50, scale: 0.95 }}
          className="bg-[#0a0a0b]/95 border border-white/10 p-8 w-full max-w-lg shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* Decorative background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-rose-500/10 blur-[100px] pointer-events-none" />

          <h2 className="text-3xl font-bold text-zinc-100 mb-2 font-headline tracking-wide relative z-10">Session Ended</h2>
          <p className="text-zinc-400 mb-8 font-headline leading-relaxed relative z-10">
            "{summary.name}" has been closed by the host. Thanks for watching!
          </p>

          <div className="grid grid-cols-2 gap-4 w-full mb-8 relative z-10">
            <div className="bg-white/5 p-4 border border-white/5">
              <div className="text-4xl font-bold tracking-tight text-zinc-100 mb-2 font-headline">
                {summary.participantsCount}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
                Peak Viewers
              </div>
            </div>
            <div className="bg-white/5 p-4 border border-white/5">
              <div className="text-4xl font-bold tracking-tight text-zinc-100 mb-2 font-headline">
                {summary.messagesCount}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
                Messages Sent
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 transition-all shadow-[0_0_20px_rgba(225,29,72,0.3)] hover:shadow-[0_0_30px_rgba(225,29,72,0.5)] tracking-widest font-headline mt-2 relative z-10 uppercase text-sm"
          >
            Return to Dashboard
          </button>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
}
