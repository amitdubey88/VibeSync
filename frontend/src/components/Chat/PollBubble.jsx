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
    <div className="bg-gray-800/80 rounded-xl p-4 my-2 border border-blue-500/30 w-full max-w-[300px]">
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-white font-medium text-sm break-words">{poll.question}</h4>
        {poll.active && canEnd && (
          <span 
            onClick={() => onEnd && onEnd(poll.id)}
            className="text-[10px] bg-red-500/20 text-red-300 px-2 py-1 rounded cursor-pointer hover:bg-red-500/40 transition-colors"
          >
            End Poll
          </span>
        )}
      </div>

      <div className="space-y-2">
        {poll.options.map(option => {
          const hasVoted = option.votes.includes(user?.id);
          const percentage = totalVotes === 0 ? 0 : Math.round((option.votes.length / totalVotes) * 100);

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={!poll.active}
              className={`relative w-full text-left overflow-hidden rounded-lg p-2 transition-all 
                ${!poll.active ? 'cursor-default opacity-80' : 'hover:bg-gray-700/50 cursor-pointer'}
                ${hasVoted ? 'border border-blue-500 bg-blue-500/10' : 'bg-gray-900/50'}
              `}
            >
              <div 
                className="absolute left-0 top-0 bottom-0 bg-blue-500/20 transition-all duration-500 z-0" 
                style={{ width: `${percentage}%` }} 
              />
              <div className="relative z-10 flex justify-between items-center text-xs">
                <span className="text-gray-200">{option.text}</span>
                <span className="text-gray-400 font-mono ml-2">{percentage}%</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between items-center text-[10px] text-gray-500">
        <span>{totalVotes} vote{totalVotes !== 1 && 's'}</span>
        <span className={poll.active ? 'text-green-400' : 'text-red-400'}>
          {poll.active ? 'Active' : 'Ended'} by {poll.createdBy}
        </span>
      </div>
    </div>
  );
}
