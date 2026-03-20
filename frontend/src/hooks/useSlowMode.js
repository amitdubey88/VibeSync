import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

export const useSlowMode = () => {
  const { socket } = useSocket();
  const { room } = useRoom();
  const [slowMode, setSlowMode] = useState({ enabled: false, cooldown: 10 });
  const [remainingCooldown, setRemainingCooldown] = useState(0);

  useEffect(() => {
    if (room?.slowMode) {
      setSlowMode(room.slowMode);
    }
  }, [room?.slowMode]);

  useEffect(() => {
    if (!socket) return;

    const onSlowModeUpdated = ({ slowMode: sm }) => setSlowMode(sm);
    const onSlowModeBlocked = ({ remaining }) => {
      setRemainingCooldown(remaining);
      // Start countdown
      const int = setInterval(() => {
        setRemainingCooldown(prev => {
          if (prev <= 1) {
            clearInterval(int);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    socket.on('room:slowmode:updated', onSlowModeUpdated);
    socket.on('room:slowmode:blocked', onSlowModeBlocked);

    return () => {
      socket.off('room:slowmode:updated', onSlowModeUpdated);
      socket.off('room:slowmode:blocked', onSlowModeBlocked);
    };
  }, [socket]);

  const toggleSlowMode = useCallback((enabled, cooldown = 10) => {
    if (!socket || !room) return;
    socket.emit('room:slowmode:set', { roomCode: room.code, enabled, cooldown });
  }, [socket, room]);

  return { 
    isSlowMode: slowMode.enabled, 
    cooldown: slowMode.cooldown, 
    remainingCooldown,
    toggleSlowMode
  };
};
