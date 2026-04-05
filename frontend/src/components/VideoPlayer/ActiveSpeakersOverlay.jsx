'use client';

import React, { useState, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { Mic } from 'lucide-react';

const ActiveSpeakersOverlay = () => {
  const { participants, user } = useRoom();
  const [speakers, setSpeakers] = useState([]);

  useEffect(() => {
    const handleActiveSpeakers = (e) => {
      const activeSocketIds = e.detail || [];
      const newSpeakers = activeSocketIds.map(id => {
        // Find if this socket belongs to the local user
        const isLocalUser = id === 'local' || participants.find(p => p.userId === user?.id)?.socketId === id || user?.socketId === id;
        
        if (isLocalUser) {
           return user.username;
        }

        const participant = participants.find(p => p.socketId === id);
        return participant ? participant.username : null;
      }).filter(Boolean); // remove nulls

      // Deduplicate names to prevent multiples if something goes weird
      setSpeakers([...new Set(newSpeakers)]);
    };

    window.addEventListener('voice:active-speakers', handleActiveSpeakers);
    return () => window.removeEventListener('voice:active-speakers', handleActiveSpeakers);
  }, [participants, user]);

  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {speakers.map((username, idx) => (
        <div 
          key={username}
          className="animate-slide-left flex items-center gap-2 bg-surface-container-high/80 backdrop-blur-xl border border-white/5 px-3 py-1.5  shadow-2xl"
          style={{ animationDelay: `${idx * 0.05}s` }}
        >
          <div className="relative flex items-center justify-center w-5 h-5  bg-violet-500/20 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.5)]">
            <Mic className="w-3 h-3 animate-pulse" />
          </div>
          <span className="text-xs font-semibold text-zinc-300 font-headline tracking-widest uppercase">
            {username}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ActiveSpeakersOverlay;
