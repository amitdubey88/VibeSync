import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function OfflineShell() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <Motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[999] bg-amber-600/90 text-white px-4 py-2 text-center text-sm font-bold backdrop-blur-3xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.5)] font-headline tracking-wide border-b border-amber-500/30"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 011.838 12.383m-15.04-2.844a9 9 0 011.455-11.375M12 2v2m0 16v2m8-10h2M2 12h2m4.95-7.05l1.414 1.414m9.9 9.9l1.414 1.414m-12.728 0l1.414-1.414m9.9-9.9l1.414-1.414" />
            {/* Strikethrough for offline concept */}
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
          You are offline. Reconnecting...
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
