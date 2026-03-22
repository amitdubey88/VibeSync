import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { motion as Motion } from 'framer-motion';

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
    <div className="bg-[#13131a]/95 backdrop-blur-3xl rounded-3xl p-5 border border-white/5 w-full max-w-[320px] shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-fade-in group/poll">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest opacity-80">Active Poll</span>
          <h4 className="text-zinc-100 font-bold text-sm leading-relaxed font-headline tracking-wide">{poll.question}</h4>
        </div>
        {poll.active && canEnd && (
          <button 
            onClick={() => onEnd && onEnd(poll.id)}
            className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl hover:bg-rose-500/20 font-bold tracking-wide font-headline transition-all active:scale-95 uppercase tracking-tighter"
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
                  ? 'border-fuchsia-500 bg-fuchsia-500/15 shadow-[0_0_15px_rgba(217,70,239,0.15)]' 
                  : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'}
              `}
            >
              <Motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                className={`absolute left-0 top-0 bottom-0 ${hasVoted ? 'bg-fuchsia-500/20' : 'bg-white/10'} transition-all duration-1000 z-0`} 
              />
              <div className="relative z-10 flex justify-between items-center">
                <span className={`text-xs font-semibold ${hasVoted ? 'text-fuchsia-400' : 'text-zinc-300 font-medium font-headline tracking-wide'}`}>{option.text}</span>
                <span className={`text-[11px] font-black ${hasVoted ? 'text-fuchsia-400' : 'text-zinc-500'}`}>{percentage}%</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 flex justify-between items-center text-[10px] border-t border-white/5">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <div className="flex -space-x-1.5">
            {[...Array(Math.min(3, totalVotes))].map((_, i) => (
              <div key={i} className="w-3.5 h-3.5 rounded-full border border-black bg-white/10 shadow-sm" />
            ))}
          </div>
          <span className="font-bold">{totalVotes} vote{totalVotes !== 1 && 's'}</span>
        </div>
        <span className={`font-black uppercase tracking-widest ${poll.active ? 'text-emerald-400' : 'text-rose-400'}`}>
          {poll.active ? 'Live' : 'Ended'}
        </span>
      </div>
    </div>
  );
}
