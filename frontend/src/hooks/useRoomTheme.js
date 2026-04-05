'use client';

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
        '--bg-primary': '8 8 15', 
        '--bg-secondary': '15 15 26',
        '--bg-card': '19 19 31',
        '--bg-hover': '26 26 46',
        '--accent-red': '229 9 20',
        '--accent-red-hover': '244 6 18',
        '--border-dark': '30 30 48',
        '--border-light': '42 42 64',
        '--obsidian-bg': '14 14 15',
        '--obsidian-surface': '14 14 15',
        '--obsidian-surface-bright': '44 44 45',
        '--obsidian-surface-dim': '14 14 15',
        '--obsidian-primary': '189 157 255',
        '--obsidian-primary-dim': '138 76 252',
      },
      crimson: { 
        '--bg-primary': '26 5 5',
        '--bg-secondary': '38 10 10',
        '--bg-card': '46 13 13',
        '--bg-hover': '61 18 18',
        '--accent-red': '255 77 77',
        '--accent-red-hover': '255 102 102',
        '--border-dark': '56 16 16',
        '--border-light': '77 22 22',
        '--obsidian-bg': '26 5 5',
        '--obsidian-surface': '38 10 10',
        '--obsidian-surface-bright': '77 22 22',
        '--obsidian-surface-dim': '26 5 5',
        '--obsidian-primary': '255 77 77',
        '--obsidian-primary-dim': '255 40 40',
      },
      ocean: { 
        '--bg-primary': '5 15 26',
        '--bg-secondary': '10 26 46',
        '--bg-card': '13 33 56',
        '--bg-hover': '18 42 71',
        '--accent-red': '0 170 255',
        '--accent-red-hover': '51 187 255',
        '--border-dark': '16 37 61',
        '--border-light': '22 49 82',
        '--obsidian-bg': '5 15 26',
        '--obsidian-surface': '10 26 46',
        '--obsidian-surface-bright': '22 49 82',
        '--obsidian-surface-dim': '5 15 26',
        '--obsidian-primary': '0 170 255',
        '--obsidian-primary-dim': '0 136 204',
      },
      forest: { 
        '--bg-primary': '5 26 13',
        '--bg-secondary': '10 46 22',
        '--bg-card': '13 56 28',
        '--bg-hover': '18 71 36',
        '--accent-red': '0 255 136',
        '--accent-red-hover': '51 255 163',
        '--border-dark': '16 61 32',
        '--border-light': '22 82 42',
        '--obsidian-bg': '5 26 13',
        '--obsidian-surface': '10 46 22',
        '--obsidian-surface-bright': '22 82 42',
        '--obsidian-surface-dim': '5 26 13',
        '--obsidian-primary': '0 255 136',
        '--obsidian-primary-dim': '0 204 108',
      },
      gold: { 
        '--bg-primary': '26 24 5',
        '--bg-secondary': '46 42 10',
        '--bg-card': '56 51 13',
        '--bg-hover': '71 65 18',
        '--accent-red': '255 204 0',
        '--accent-red-hover': '255 214 51',
        '--border-dark': '61 55 16',
        '--border-light': '82 74 22',
        '--obsidian-bg': '26 24 5',
        '--obsidian-surface': '46 42 10',
        '--obsidian-surface-bright': '82 74 22',
        '--obsidian-surface-dim': '26 24 5',
        '--obsidian-primary': '255 204 0',
        '--obsidian-primary-dim': '204 163 0',
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
