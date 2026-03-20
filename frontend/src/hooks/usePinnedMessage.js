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

      // Decrypt if explicitly marked OR if content looks like base64-encrypted data (fallback)
      const isEncrypted = msg.e2ee || (
        typeof msg.content === 'string' && 
        msg.content.length > 20 && 
        !msg.content.includes(' ') && 
        /^[a-zA-Z0-9+/]*={0,2}$/.test(msg.content)
      );

      if (isEncrypted && roomKey) {
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
      if (!msg) {
        setPinnedMessage(null);
        return;
      }

      const isEncrypted = msg.e2ee || (
        typeof msg.content === 'string' && 
        msg.content.length > 20 && 
        !msg.content.includes(' ') && 
        /^[a-zA-Z0-9+/]*={0,2}$/.test(msg.content)
      );

      if (isEncrypted && roomKey) {
        try {
          const decryptedContent = await decryptData(msg.content, roomKey);
          setPinnedMessage({ ...msg, content: decryptedContent });
        } catch (err) {
          console.error('[E2EE] Socket pinned message decryption failed:', err);
          setPinnedMessage(msg);
        }
      } else {
        setPinnedMessage(msg);
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
