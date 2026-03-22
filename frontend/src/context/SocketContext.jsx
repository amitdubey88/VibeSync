import { createContext, useEffect, useState, useContext } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useAuth } from './AuthContext';

// eslint-disable-next-line react-refresh/only-export-components
export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Token cleared (logout) — tear down socket and reset state.
    if (!token) {
      disconnectSocket();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const s = connectSocket(token);
    setSocket(s);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    // Setup listeners BEFORE checking connection state ensuring no skipped events
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // Explicitly sync the state in case it connected synchronously or beforehand
    setIsConnected(s.connected);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
