import React from 'react';
import { useSubtitles } from '../../hooks/useSubtitles';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function SubtitleOverlay() {
  const { activeCue } = useSubtitles();

  return (
    <AnimatePresence>
      {activeCue && (
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 text-center z-40 pointer-events-none drop-shadow-2xl"
        >
          {/* Subtitle text formatting mimicking standard CC */}
          <span 
            className="inline-block px-4 py-2 bg-black/70 backdrop-blur-sm rounded-lg text-white font-sans md:text-2xl sm:text-lg text-base leading-tight tracking-wide"
            style={{ 
              textShadow: '0px 2px 4px rgba(0,0,0,0.8), 0px 0px 2px rgba(0,0,0,0.8)',
              whiteSpace: 'pre-line' 
            }}
          >
            {activeCue}
          </span>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
