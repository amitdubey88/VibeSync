import React, { useState, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function CountdownLobby() {
  const { room } = useRoom();
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!room?.scheduledAt) {
      setTimeLeft(null);
      return;
    }

    const scheduledTime = new Date(room.scheduledAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = scheduledTime - now;

      if (diff <= 0) {
        setTimeLeft(0);
        return;
      }

      setTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.scheduledAt]);

  if (timeLeft === null || timeLeft <= 0) return null;

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
      >
        <div className="absolute top-8 text-white/50 text-sm font-medium tracking-widest uppercase">
          VibeSync Premiere
        </div>

        <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 text-center max-w-2xl px-4">
          {room.name}
        </h1>
        <p className="text-gray-400 mb-12">Starting soon. Sit tight and vibe.</p>

        <div className="flex items-center gap-4 text-center">
          <div className="flex flex-col items-center">
            <div className="text-5xl md:text-7xl font-mono font-bold text-blue-500 bg-blue-500/10 px-4 py-6 rounded-2xl border border-blue-500/20 w-32 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              {String(hours).padStart(2, '0')}
            </div>
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-4">Hours</span>
          </div>

          <span className="text-4xl text-gray-700 font-bold -mt-8">:</span>

          <div className="flex flex-col items-center">
            <div className="text-5xl md:text-7xl font-mono font-bold text-blue-500 bg-blue-500/10 px-4 py-6 rounded-2xl border border-blue-500/20 w-32 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              {String(minutes).padStart(2, '0')}
            </div>
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-4">Minutes</span>
          </div>

          <span className="text-4xl text-gray-700 font-bold -mt-8">:</span>

          <div className="flex flex-col items-center">
            <div className="text-5xl md:text-7xl font-mono font-bold text-white bg-white/5 px-4 py-6 rounded-2xl border border-white/10 w-32 shadow-2xl">
              {String(seconds).padStart(2, '0')}
            </div>
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-4">Seconds</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
