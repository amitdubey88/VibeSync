import React, { useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function KeyboardShortcutsPanel({ isOpen, onClose }) {
  // Listen for '?' shortcut to toggle globally
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause Video' },
    { key: 'M', desc: 'Mute / Unmute Video' },
    { key: 'F', desc: 'Toggle Fullscreen' },
    { key: 'C', desc: 'Toggle Chat Panel' },
    { key: 'P', desc: 'Toggle Participants Panel' },
    { key: 'V', desc: 'Toggle Voice Chat' },
    { key: '?', desc: 'Show Keyboard Shortcuts' },
    { key: 'Esc', desc: 'Close Modals / Panels' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-3xl"
      >
        <Motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0a0a0b]/95 border border-white/5 p-6 rounded-3xl w-full max-w-sm shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-zinc-100 rounded-full hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-lg font-bold text-zinc-100 mb-6 font-headline tracking-wide">Keyboard Shortcuts</h2>
          
          <div className="space-y-4">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-zinc-300 font-headline tracking-wide">{s.desc}</span>
                <kbd className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-fuchsia-400 shadow-sm font-bold tracking-widest">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
}
