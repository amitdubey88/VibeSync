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
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <Motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-lg font-bold text-white mb-6">Keyboard Shortcuts</h2>
          
          <div className="space-y-4">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-gray-300">{s.desc}</span>
                <kbd className="px-2.5 py-1 bg-white/10 border border-white/20 rounded text-xs font-mono text-white shadow-sm">
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
