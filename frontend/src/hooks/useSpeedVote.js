'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

export const useSpeedVote = () => {
  const { socket } = useSocket();
  const { room } = useRoom();
  const [voteStats, setVoteStats] = useState({ votes: {}, total: 0 });
  const [voteResult, setVoteResult] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const onVoteUpdate = (stats) => setVoteStats(stats);
    const onSpeedResult = (result) => {
      setVoteResult(result);
      setVoteStats({ votes: {}, total: 0 });
    };

    socket.on('speed:vote-update', onVoteUpdate);
    socket.on('speed:result', onSpeedResult);

    return () => {
      socket.off('speed:vote-update', onVoteUpdate);
      socket.off('speed:result', onSpeedResult);
    };
  }, [socket]);

  const submitVote = useCallback((speed) => {
    if (!socket || !room) return;
    socket.emit('speed:vote', { roomCode: room.code, speed });
  }, [socket, room]);

  const clearResult = useCallback(() => setVoteResult(null), []);

  return { voteStats, voteResult, submitVote, clearResult };
};
