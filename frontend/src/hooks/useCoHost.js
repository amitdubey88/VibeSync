import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';

export const useCoHost = () => {
  const { socket } = useSocket();
  const { room } = useRoom();
  const { user } = useAuth();
  const [coHosts, setCoHosts] = useState([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCoHosts(room?.coHosts || []);
  }, [room?.coHosts]);

  useEffect(() => {
    if (!socket) return;

    const onCoHostUpdated = ({ coHosts: updatedCoHosts }) => setCoHosts(updatedCoHosts);

    socket.on('room:cohost-updated', onCoHostUpdated);

    return () => {
      socket.off('room:cohost-updated', onCoHostUpdated);
    };
  }, [socket]);

  const assignCoHost = useCallback((targetUserId) => {
    if (!socket || !room) return;
    socket.emit('room:assign-cohost', { roomCode: room.code, targetUserId });
  }, [socket, room]);

  const removeCoHost = useCallback((targetUserId) => {
    if (!socket || !room) return;
    socket.emit('room:remove-cohost', { roomCode: room.code, targetUserId });
  }, [socket, room]);

  const isCoHost = Boolean(user && coHosts.includes(user.id));

  return { coHosts, isCoHost, assignCoHost, removeCoHost };
};
