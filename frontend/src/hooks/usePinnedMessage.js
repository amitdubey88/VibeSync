import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import { decryptData } from '../utils/crypto';

export const usePinnedMessage = () => {
  const { socket } = useSocket();
  const { room, roomKey } = useRoom();
  const [pinnedMessage, setPinnedMessage] = useState(null);

  useEffect(() => {
    const decryptAndSet = async (msg) => {
      if (!msg) {
        setPinnedMessage(null);
        return;
      }

      if (msg.e2ee && roomKey) {
        try {
          const decryptedContent = await decryptData(msg.content, roomKey);
          setPinnedMessage({ ...msg, content: decryptedContent });
        } catch (err) {
          console.error('[E2EE] Pinned message decryption failed:', err);
          setPinnedMessage(msg);
        }
      } else {
        setPinnedMessage(msg);
      }
    };

    decryptAndSet(room?.pinnedMessage);
  }, [room?.pinnedMessage, roomKey]);

  useEffect(() => {
    if (!socket) return;

    const onPinned = async ({ pinnedMessage: msg }) => {
      if (msg && msg.e2ee && roomKey) {
        try {
          const decryptedContent = await decryptData(msg.content, roomKey);
          setPinnedMessage({ ...msg, content: decryptedContent });
        } catch (err) {
          console.error('[E2EE] Socket pinned message decryption failed:', err);
          setPinnedMessage(msg);
        }
      } else {
        setPinnedMessage(msg || null);
      }
    };

    const onUnpinned = () => setPinnedMessage(null);

    socket.on('chat:pinned', onPinned);
    socket.on('chat:unpinned', onUnpinned);

    return () => {
      socket.off('chat:pinned', onPinned);
      socket.off('chat:unpinned', onUnpinned);
    };
  }, [socket, roomKey]);

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
