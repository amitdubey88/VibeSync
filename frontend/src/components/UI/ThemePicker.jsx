import React from 'react';
import { useRoomTheme } from '../../hooks/useRoomTheme';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { motion, AnimatePresence } from 'framer-motion';

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
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute top-16 right-4 w-64 bg-gray-900 border border-white/10 rounded-xl p-4 shadow-2xl z-50"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold text-sm">Theater Theme</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-2">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => isHost && changeTheme(t.id)}
              disabled={!isHost}
              className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
                theme === t.id 
                  ? 'border-accent-purple bg-accent-purple/10' 
                  : 'border-white/5 hover:border-white/20 bg-black/30'
              } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-sm font-medium text-gray-200">{t.name}</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: t.color }}></div>
                <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: t.accent }}></div>
              </div>
            </button>
          ))}
        </div>
        
        {!isHost && (
          <p className="text-[10px] text-gray-500 mt-3 text-center uppercase tracking-wider">
            Only the host can change themes
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
