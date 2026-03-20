import React from 'react';
import { useSpeedVote } from '../../hooks/useSpeedVote';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { motion, AnimatePresence } from 'framer-motion';

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 border border-blue-500/50 rounded-xl p-4 shadow-2xl z-50 flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <p className="text-white font-medium text-sm">
              Majority reached for <span className="text-blue-400 font-bold">{voteResult.speed}x</span> speed
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                updatePlaybackSpeed(voteResult.speed);
                clearResult();
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Apply Speed
            </button>
            <button
              onClick={clearResult}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Floating generic participant vote panel (can pop out from a control button)
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/50 hover:bg-black/90 backdrop-blur-md rounded-xl p-3 border border-white/10 w-64 shadow-2xl transition-all opacity-30 hover:opacity-100">
      <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3 flex justify-between">
        <span>Vote Speed</span>
        {hasVotes && <span className="text-blue-400">{voteStats.total} total</span>}
      </h4>
      <div className="flex justify-between gap-1">
        {speeds.map(s => {
          const count = voteStats.votes[s] || 0;
          return (
            <button
              key={s}
              onClick={() => submitVote(s)}
              className="flex-1 flex flex-col items-center justify-center bg-gray-800/80 hover:bg-blue-600 p-2 rounded-lg transition-colors group relative"
            >
              <span className="text-white font-mono text-sm">{s}x</span>
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
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
