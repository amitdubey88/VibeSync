import React from 'react';
import { useRoomTheme } from '../../hooks/useRoomTheme';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function ThemePicker({ isOpen, onClose }) {
  const { theme, changeTheme } = useRoomTheme();
  const { user } = useAuth();
  const { room } = useRoom();

  const isHost = room?.hostId === user?.id;

  if (!isOpen) return null;

  const themes = [
    { id: 'default', name: 'Default Void', color: '#0a0a0f', accent: '#e50914' },
    { id: 'crimson', name: 'Crimson Glow', color: '#1a0505', accent: '#ff3333' },
    { id: 'ocean', name: 'Deep Ocean', color: '#05101a', accent: '#00aaff' },
    { id: 'forest', name: 'Neon Forest', color: '#051a0d', accent: '#00ff88' },
    { id: 'gold', name: 'Golden Hour', color: '#1a1805', accent: '#ffcc00' },
  ];

  return (
    <AnimatePresence>
      <Motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute top-16 right-4 w-64 bg-[#0a0a0b]/95 backdrop-blur-3xl border border-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-zinc-100 font-bold text-sm font-headline tracking-wide">Theater Theme</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-2">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => isHost && changeTheme(t.id)}
              disabled={!isHost}
              className={`w-full flex items-center justify-between p-2 border transition-all ${
                theme === t.id 
                  ? 'border-fuchsia-500 bg-fuchsia-500/10 shadow-[0_0_15px_rgba(217,70,239,0.15)]' 
                  : 'border-white/5 hover:border-white/20 bg-white/5'
              } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-sm font-medium text-zinc-200 font-headline">{t.name}</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border border-white/20" style={{ backgroundColor: t.color }}></div>
                <div className="w-3 h-3 border border-white/20" style={{ backgroundColor: t.accent }}></div>
              </div>
            </button>
          ))}
        </div>
        
        {!isHost && (
          <p className="text-[10px] text-zinc-500 font-headline font-bold mt-3 text-center uppercase tracking-wider">
            Only the host can change themes
          </p>
        )}
      </Motion.div>
    </AnimatePresence>
  );
}
