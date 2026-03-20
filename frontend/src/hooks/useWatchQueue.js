import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

export const useWatchQueue = () => {
  const { socket } = useSocket();
  const { room } = useRoom();
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    setQueue(room?.watchQueue || []);
  }, [room?.watchQueue]);

  useEffect(() => {
    if (!socket) return;

    const onQueueUpdated = ({ queue: q }) => setQueue(q);

    socket.on('queue:updated', onQueueUpdated);

    // Host specifically needs to listen for when a queue item is approved to load it
    // The RoomContext or VideoPlayer needs to handle this, but the hook exposes it
    return () => {
      socket.off('queue:updated', onQueueUpdated);
    };
  }, [socket]);

  const suggestVideo = useCallback((video) => {
    if (!socket || !room) return;
    socket.emit('queue:suggest', { roomCode: room.code, video });
  }, [socket, room]);

  const approveItem = useCallback((itemId) => {
    if (!socket || !room) return;
    socket.emit('queue:approve', { roomCode: room.code, itemId });
  }, [socket, room]);

  const removeItem = useCallback((itemId) => {
    if (!socket || !room) return;
    socket.emit('queue:remove', { roomCode: room.code, itemId });
  }, [socket, room]);

  const reorderQueue = useCallback((orderedIds) => {
    if (!socket || !room) return;
    socket.emit('queue:reorder', { roomCode: room.code, orderedIds });
    // Optimistic UI update
    setQueue(prev => {
      const qMap = Object.fromEntries(prev.map(item => [item.id, item]));
      return orderedIds.map(id => qMap[id]).filter(Boolean);
    });
  }, [socket, room]);

  return { queue, suggestVideo, approveItem, removeItem, reorderQueue };
};
