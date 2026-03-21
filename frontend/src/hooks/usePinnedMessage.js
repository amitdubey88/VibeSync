import { useState, useEffect, useCallback } from 'react';
import { Pin, PinOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import { decryptData } from '../utils/crypto';

export const usePinnedMessage = () => {
  const { socket } = useSocket();
  const { room, roomKey } = useRoom();
  
  // Track the raw message from the server (encrypted)
  const [rawPinnedMessage, setRawPinnedMessage] = useState(room?.pinnedMessage || null);
  // Track the decrypted message for display
  const [pinnedMessage, setPinnedMessage] = useState(null);

  // Sync raw message from room state updates
  useEffect(() => {
    setRawPinnedMessage(room?.pinnedMessage || null);
  }, [room?.pinnedMessage]);

  // Sync raw message from socket events
  useEffect(() => {
    if (!socket) return;

    const onPinned = ({ pinnedMessage: msg }) => {
      setRawPinnedMessage(msg || null);
      toast('Message pinned!', { 
        duration: 3000, 
        icon: <Pin className="w-5 h-5 text-accent-purple" />,
        style: { background: '#2C2B35', color: '#fff' } 
      });
    };

    const onUnpinned = () => {
      setRawPinnedMessage(null);
      toast('Message unpinned', { 
        icon: <PinOff className="w-5 h-5 text-text-muted" />, 
        duration: 2000, 
        style: { background: '#2C2B35', color: '#fff' } 
      });
    };

    socket.on('chat:pinned', onPinned);
    socket.on('chat:unpinned', onUnpinned);

    return () => {
      socket.off('chat:pinned', onPinned);
      socket.off('chat:unpinned', onUnpinned);
    };
  }, [socket]);

  // Handle Decryption: triggers whenever raw message or roomKey changes
  useEffect(() => {
    const decryptEffect = async () => {
      if (!rawPinnedMessage) {
        setPinnedMessage(null);
        return;
      }

      // Decrypt if explicitly marked OR if content looks like base64-encrypted data (fallback)
      const isEncrypted = rawPinnedMessage.e2ee || (
        typeof rawPinnedMessage.content === 'string' && 
        rawPinnedMessage.content.length > 20 && 
        !rawPinnedMessage.content.includes(' ') && 
        /^[a-zA-Z0-9+/]*={0,2}$/.test(rawPinnedMessage.content)
      );

      if (isEncrypted && roomKey) {
        try {
          const decryptedContent = await decryptData(rawPinnedMessage.content, roomKey);
          setPinnedMessage({ ...rawPinnedMessage, content: decryptedContent });
        } catch (err) {
          console.error('[E2EE] Pinned message decryption failed:', err);
          setPinnedMessage(rawPinnedMessage);
        }
      } else {
        setPinnedMessage(rawPinnedMessage);
      }
    };

    decryptEffect();
  }, [rawPinnedMessage, roomKey]);

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
