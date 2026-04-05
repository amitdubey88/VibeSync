'use client';

import React from 'react';
import { useSpeedVote } from '../../hooks/useSpeedVote';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function SpeedVotePanel() {
  const { voteStats, voteResult, submitVote, clearResult } = useSpeedVote();
  const { user } = useAuth();
  const { room, updatePlaybackSpeed } = useRoom();

  const isHost = room?.hostId === user?.id;
  const speeds = [0.75, 1, 1.25, 1.5, 2];
  
  const hasVotes = Object.keys(voteStats.votes).length > 0;
  
  // Host prompt when a majority is reached
  if (isHost && voteResult) {
    return (
      <AnimatePresence>
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-violet-500/30  p-4 shadow-2xl z-50 flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <p className="text-white font-medium text-sm">
              Majority reached for <span className="text-violet-400 font-bold font-headline">{voteResult.speed}x</span> speed
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                updatePlaybackSpeed(voteResult.speed);
                clearResult();
              }}
              className="bg-violet-500 text-white hover:bg-violet-400 text-white px-4 py-1.5  text-sm font-semibold transition-colors shadow-[0_4px_15px_rgba(139,92,246,0.5)]"
            >
              Apply Speed
            </button>
            <button
              onClick={clearResult}
              className="bg-white/10 hover:bg-white/20 text-zinc-300 text-white px-4 py-1.5  text-sm transition-colors"
            >
              Dismiss
            </button>
          </div>
        </Motion.div>
      </AnimatePresence>
    );
  }

  // Floating generic participant vote panel (can pop out from a control button)
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/40 hover:bg-black/80 backdrop-blur-xl  p-3 border border-white/10 w-64 shadow-2xl transition-all opacity-30 hover:opacity-100">
      <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3 flex justify-between">
        <span>Vote Speed</span>
        {hasVotes && <span className="text-fuchsia-400">{voteStats.total} total</span>}
      </h4>
      <div className="flex justify-between gap-1">
        {speeds.map(s => {
          const count = voteStats.votes[s] || 0;
          return (
            <button
              key={s}
              onClick={() => submitVote(s)}
              className="flex-1 flex flex-col items-center justify-center bg-white/5 hover:bg-fuchsia-500/30 font-headline p-2  transition-colors group relative"
            >
              <span className="text-white font-mono text-sm">{s}x</span>
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-fuchsia-500 text-white text-[10px] w-4 h-4  flex items-center justify-center font-bold shadow-[0_0_10px_rgba(217,70,239,0.8)]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
