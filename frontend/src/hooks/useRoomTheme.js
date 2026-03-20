import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

export const useRoomTheme = () => {
  const { socket } = useSocket();
  const { room } = useRoom();
  const [theme, setTheme] = useState('default');

  // Apply theme to document element
  useEffect(() => {
    const root = document.documentElement;
    // Map of theme definitions (CSS var overrides)
    const themes = {
      default: { '--bg-color': '#0a0a0f', '--accent-color': '#e50914' },
      crimson: { '--bg-color': '#1a0505', '--accent-color': '#ff3333' },
      ocean:   { '--bg-color': '#05101a', '--accent-color': '#00aaff' },
      forest:  { '--bg-color': '#051a0d', '--accent-color': '#00ff88' },
      gold:    { '--bg-color': '#1a1805', '--accent-color': '#ffcc00' },
    };

    const currentTheme = themes[theme] || themes['default'];
    Object.entries(currentTheme).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    return () => {
      // Cleanup on unmount (revert to default)
      Object.keys(themes['default']).forEach(key => {
        root.style.removeProperty(key);
      });
    };
  }, [theme]);

  useEffect(() => {
    if (room?.currentTheme) {
      setTheme(room.currentTheme);
    }
  }, [room?.currentTheme]);

  useEffect(() => {
    if (!socket) return;
    const onThemeChanged = ({ theme: newTheme }) => setTheme(newTheme);
    socket.on('room:theme:changed', onThemeChanged);
    return () => socket.off('room:theme:changed', onThemeChanged);
  }, [socket]);

  const changeTheme = useCallback((newTheme) => {
    if (!socket || !room) return;
    socket.emit('room:theme:set', { roomCode: room.code, theme: newTheme });
  }, [socket, room]);

  return { theme, changeTheme };
};
