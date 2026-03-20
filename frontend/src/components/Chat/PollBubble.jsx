import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { motion } from 'framer-motion';

export default function PollBubble({ poll, onVote, onEnd }) {
  const { user } = useAuth();
  const { room } = useRoom();

  if (!poll) return null;

  const handleVote = (optionId) => {
    if (onVote) onVote(poll.id, optionId);
  };

  const isHost = room?.hostId === user?.id;
  const isCoHost = room?.coHosts?.includes(user?.id);
  const canEnd = isHost || isCoHost;

  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-4 my-2 border border-white/10 w-full max-w-[320px] shadow-2xl shadow-black/20 animate-fade-in group/poll">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-accent-purple uppercase tracking-widest opacity-80">Active Poll</span>
          <h4 className="text-text-primary font-bold text-sm leading-relaxed">{poll.question}</h4>
        </div>
        {poll.active && canEnd && (
          <button 
            onClick={() => onEnd && onEnd(poll.id)}
            className="text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg hover:bg-red-500/20 transition-all active:scale-95 uppercase tracking-tighter"
          >
            End
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {poll.options.map(option => {
          const hasVoted = option.votes.includes(user?.id);
          const percentage = totalVotes === 0 ? 0 : Math.round((option.votes.length / totalVotes) * 100);

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={!poll.active}
              className={`relative w-full text-left overflow-hidden rounded-xl p-3 transition-all active:scale-[0.98] border shadow-inner
                ${!poll.active ? 'cursor-default grayscale-[0.5] opacity-60' : 'hover:scale-[1.01] hover:shadow-lg cursor-pointer'}
                ${hasVoted 
                  ? 'border-accent-purple bg-accent-purple/15' 
                  : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'}
              `}
            >
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                className={`absolute left-0 top-0 bottom-0 ${hasVoted ? 'bg-accent-purple/20' : 'bg-white/10'} transition-all duration-1000 z-0`} 
              />
              <div className="relative z-10 flex justify-between items-center">
                <span className={`text-xs font-semibold ${hasVoted ? 'text-accent-purple' : 'text-text-secondary'}`}>{option.text}</span>
                <span className={`text-[11px] font-black ${hasVoted ? 'text-accent-purple' : 'text-text-muted'}`}>{percentage}%</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 flex justify-between items-center text-[10px] border-t border-white/5">
        <div className="flex items-center gap-1.5 text-text-muted">
          <div className="flex -space-x-1.5">
            {[...Array(Math.min(3, totalVotes))].map((_, i) => (
              <div key={i} className="w-3.5 h-3.5 rounded-full border border-bg-primary bg-bg-hover shadow-sm" />
            ))}
          </div>
          <span className="font-bold">{totalVotes} vote{totalVotes !== 1 && 's'}</span>
        </div>
        <span className={`font-black uppercase tracking-widest ${poll.active ? 'text-accent-green' : 'text-red-400'}`}>
          {poll.active ? 'Live' : 'Ended'}
        </span>
      </div>
    </div>
  );
}
