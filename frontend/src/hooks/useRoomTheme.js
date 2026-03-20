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
      default: { 
        '--bg-primary': '#08080f', 
        '--bg-secondary': '#0f0f1a',
        '--bg-card': '#13131f',
        '--bg-hover': '#1a1a2e',
        '--accent-red': '#e50914',
        '--accent-red-hover': '#f40612',
        '--border-dark': '#1e1e30',
        '--border-light': '#2a2a40',
      },
      crimson: { 
        '--bg-primary': '#1a0505',
        '--bg-secondary': '#260a0a',
        '--bg-card': '#2e0d0d',
        '--bg-hover': '#3d1212',
        '--accent-red': '#ff4d4d',
        '--accent-red-hover': '#ff6666',
        '--border-dark': '#381010',
        '--border-light': '#4d1616',
      },
      ocean: { 
        '--bg-primary': '#050f1a',
        '--bg-secondary': '#0a1a2e',
        '--bg-card': '#0d2138',
        '--bg-hover': '#122a47',
        '--accent-red': '#00aaff',
        '--accent-red-hover': '#33bbff',
        '--border-dark': '#10253d',
        '--border-light': '#163152',
      },
      forest: { 
        '--bg-primary': '#051a0d',
        '--bg-secondary': '#0a2e16',
        '--bg-card': '#0d381c',
        '--bg-hover': '#124724',
        '--accent-red': '#00ff88',
        '--accent-red-hover': '#33ffa3',
        '--border-dark': '#103d20',
        '--border-light': '#16522a',
      },
      gold: { 
        '--bg-primary': '#1a1805',
        '--bg-secondary': '#2e2a0a',
        '--bg-card': '#38330d',
        '--bg-hover': '#474112',
        '--accent-red': '#ffcc00',
        '--accent-red-hover': '#ffd633',
        '--border-dark': '#3d3710',
        '--border-light': '#524a16',
      },
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
