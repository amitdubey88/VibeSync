import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

export const usePolls = () => {
  const { socket } = useSocket();
  const { room } = useRoom();
  const [activePoll, setActivePoll] = useState(null);

  useEffect(() => {
    if (room?.activePoll) {
      setActivePoll(room.activePoll);
    } else {
      setActivePoll(null);
    }
  }, [room?.activePoll]);

  useEffect(() => {
    if (!socket) return;

    const onPollCreated = ({ poll }) => setActivePoll(poll);
    const onPollUpdated = ({ poll }) => setActivePoll(poll);
    const onPollEnded = ({ poll }) => setActivePoll(poll);

    socket.on('poll:created', onPollCreated);
    socket.on('poll:updated', onPollUpdated);
    socket.on('poll:ended', onPollEnded);

    return () => {
      socket.off('poll:created', onPollCreated);
      socket.off('poll:updated', onPollUpdated);
      socket.off('poll:ended', onPollEnded);
    };
  }, [socket]);

  const createPoll = useCallback((question, options) => {
    if (!socket || !room) return;
    socket.emit('poll:create', { roomCode: room.code, question, options });
  }, [socket, room]);

  const votePoll = useCallback((pollId, optionId) => {
    if (!socket || !room) return;
    socket.emit('poll:vote', { roomCode: room.code, pollId, optionId });
  }, [socket, room]);

  const endPoll = useCallback((pollId) => {
    if (!socket || !room) return;
    socket.emit('poll:end', { roomCode: room.code, pollId });
  }, [socket, room]);

  return { activePoll, createPoll, votePoll, endPoll };
};
