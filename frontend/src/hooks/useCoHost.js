import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';

export const useCoHost = () => {
  const { socket } = useSocket();
  const { room } = useRoom();
  const { user } = useAuth();
  const [coHosts, setCoHosts] = useState([]);

  useEffect(() => {
    setCoHosts(room?.coHosts || []);
  }, [room?.coHosts]);

  useEffect(() => {
    if (!socket) return;

    const onCoHostUpdated = ({ coHosts: updatedCoHosts }) => setCoHosts(updatedCoHosts);
    const onCoHostAssigned = ({ assignedBy }) => {
      toast.success(`👑 You have been promoted to Co-Host by ${assignedBy}!`, { duration: 4000 });
    };

    socket.on('room:cohost-updated', onCoHostUpdated);
    socket.on('room:cohost-assigned', onCoHostAssigned);

    return () => {
      socket.off('room:cohost-updated', onCoHostUpdated);
      socket.off('room:cohost-assigned', onCoHostAssigned);
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
