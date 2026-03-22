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
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      >
        <Motion.div
          initial={{ y: 50, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 50, scale: 0.95 }}
          className="bg-gray-900 border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* Decorative background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent-red/20 blur-[60px] rounded-full pointer-events-none" />

          <h2 className="text-3xl font-bold text-white mb-2 relative z-10">Session Ended</h2>
          <p className="text-gray-400 mb-8 relative z-10">
            "{summary.name}" has been closed by the host. Thanks for watching!
          </p>

          <div className="grid grid-cols-2 gap-4 w-full mb-8 relative z-10">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="text-3xl font-bold tracking-tight text-white mb-1">
                {summary.participantsCount}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                Peak Viewers
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="text-3xl font-bold tracking-tight text-white mb-1">
                {summary.messagesCount}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                Messages Sent
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-accent-red hover:bg-accent-red/90 text-white font-semibold py-3 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(229,9,20,0.4)] relative z-10"
          >
            Return to Dashboard
          </button>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
}
