import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SlowModeTimer({ remaining, isHost }) {
  if (isHost && remaining === 0) {
    return (
      <span className="absolute -top-6 left-2 px-2 py-0.5 bg-gray-800 text-[10px] text-gray-400 rounded border border-gray-700 pointer-events-none">
        Slow Mode On
      </span>
    );
  }

  return (
    <AnimatePresence>
      {remaining > 0 && typeof remaining === 'number' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute inset-0 flex items-center justify-center bg-gray-900/90 rounded-lg backdrop-blur-sm z-10 pointer-events-none"
        >
          <span className="text-sm font-semibold text-white tracking-widest font-mono">
            {remaining}s
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
