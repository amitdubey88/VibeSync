import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useRoom } from '../../context/RoomContext';
import { motion as Motion } from 'framer-motion';

export default function ModerationPanel() {
  const { socket } = useSocket();
  const { room } = useRoom();
  const [bannedWords, setBannedWords] = useState([]);
  const [newWord, setNewWord] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBannedWords(room?.bannedWords || []);
  }, [room?.bannedWords]);

  useEffect(() => {
    if (!socket) return;
    const onFilterUpdated = ({ bannedWords: bw }) => setBannedWords(bw || []);
    socket.on('room:filter:updated', onFilterUpdated);
    return () => socket.off('room:filter:updated', onFilterUpdated);
  }, [socket]);

  const handleAddWord = (e) => {
    e.preventDefault();
    if (!socket || !room) return;
    const word = newWord.trim().toLowerCase();
    if (!word || bannedWords.includes(word)) return;

    const updated = [...bannedWords, word];
    setBannedWords(updated); // Optimistic
    socket.emit('room:filter:update', { roomCode: room.code, bannedWords: updated });
    setNewWord('');
  };

  const handleRemoveWord = (word) => {
    if (!socket || !room) return;
    const updated = bannedWords.filter(w => w !== word);
    setBannedWords(updated); // Optimistic
    socket.emit('room:filter:update', { roomCode: room.code, bannedWords: updated });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-white/10 p-4">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          <span>Auto-Moderation</span>
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] uppercase font-bold tracking-wider">Host</span>
        </h3>
        <p className="text-gray-400 text-xs mt-1">
          Words added here will be automatically asterisked (***) in chat for all participants.
        </p>
      </div>

      <form onSubmit={handleAddWord} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder="Enter a word to block..."
          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!newWord.trim()}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Block
        </button>
      </form>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
        {bannedWords.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8 border border-dashed border-gray-700 rounded-xl p-6">
            <svg className="w-8 h-8 mx-auto text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            No blocked words yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bannedWords.map(word => (
              <Motion.span
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key={word}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-200 rounded-full text-sm"
              >
                {word}
                <button
                  onClick={() => handleRemoveWord(word)}
                  className="hover:text-white text-red-400 focus:outline-none transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </Motion.span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
