import React, { useState, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function CountdownLobby() {
  const { room } = useRoom();
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!room?.scheduledAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <Motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
      >
        <div className="absolute top-8 text-white/50 text-sm font-medium tracking-widest uppercase">
          VibeSync Premiere
        </div>

        <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 text-center max-w-2xl px-4">
          {room?.name}
        </h1>
        <p className="text-zinc-500 font-headline mb-12">Starting soon. Sit tight and vibe.</p>

        <div className="flex items-center gap-2 md:gap-4 text-center">
          <div className="flex flex-col items-center">
            <div className="text-3xl md:text-7xl font-mono font-bold text-rose-500 bg-rose-500/10 px-2 py-4 md:px-4 md:py-6 border border-rose-500/20 w-24 md:w-32 shadow-[0_0_30px_rgba(225,29,72,0.3)] font-headline">
              {String(hours).padStart(2, '0')}
            </div>
            <span className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-4 font-headline">Hours</span>
          </div>

          <span className="text-2xl md:text-4xl text-zinc-800 font-bold -mt-6 md:-mt-8">:</span>

          <div className="flex flex-col items-center">
            <div className="text-3xl md:text-7xl font-mono font-bold text-rose-500 bg-rose-500/10 px-2 py-4 md:px-4 md:py-6 border border-rose-500/20 w-24 md:w-32 shadow-[0_0_30px_rgba(225,29,72,0.3)] font-headline">
              {String(minutes).padStart(2, '0')}
            </div>
            <span className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-4 font-headline">Minutes</span>
          </div>

          <span className="text-2xl md:text-4xl text-zinc-800 font-bold -mt-6 md:-mt-8">:</span>

          <div className="flex flex-col items-center">
            <div className="text-3xl md:text-7xl font-mono font-bold text-white bg-black/40 px-2 py-4 md:px-4 md:py-6 border border-white/5 w-24 md:w-32 shadow-[0_10px_40px_rgba(0,0,0,0.8)] font-headline">
              {String(seconds).padStart(2, '0')}
            </div>
            <span className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-4 font-headline">Seconds</span>
          </div>
        </div>
      </Motion.div>
    </AnimatePresence>
  );
}
