import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

export const usePinnedMessage = () => {
  const { socket } = useSocket();
  const { room } = useRoom();
  const [pinnedMessage, setPinnedMessage] = useState(null);

  useEffect(() => {
    setPinnedMessage(room?.pinnedMessage || null);
  }, [room?.pinnedMessage]);

  useEffect(() => {
    if (!socket) return;

    const onPinned = ({ pinnedMessage: msg }) => setPinnedMessage(msg);
    const onUnpinned = () => setPinnedMessage(null);

    socket.on('chat:pinned', onPinned);
    socket.on('chat:unpinned', onUnpinned);

    return () => {
      socket.off('chat:pinned', onPinned);
      socket.off('chat:unpinned', onUnpinned);
    };
  }, [socket]);

  const pinMessage = useCallback((messageId) => {
    if (!socket || !room) return;
    socket.emit('chat:pin', { roomCode: room.code, messageId });
  }, [socket, room]);

  const unpinMessage = useCallback(() => {
    if (!socket || !room) return;
    socket.emit('chat:unpin', { roomCode: room.code });
  }, [socket, room]);

  return { pinnedMessage, pinMessage, unpinMessage };
};
