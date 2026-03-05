import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginAsGuest, verifyOtp, sendOtp } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('vibesync_token'));
  const [loading, setLoading] = useState(true);

  // On mount, restore user from stored token
  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Check if token is expired
        if (payload.exp * 1000 > Date.now()) {
          setUser({ id: payload.id, username: payload.username, avatar: payload.avatar, isGuest: payload.isGuest });
        } else {
          logout();
        }
      } catch (_) {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const saveAuth = useCallback((data) => {
    const { token: t, user: u } = data;
    localStorage.setItem('vibesync_token', t);
    setToken(t);
    setUser(u);
    connectSocket(t);
  }, []);

  const guestLogin = useCallback(async (username) => {
    const data = await loginAsGuest(username);
    saveAuth(data);
    return data;
  }, [saveAuth]);

  const otpLogin = useCallback(async (email, otp, username) => {
    const data = await verifyOtp(email, otp, username);
    saveAuth(data);
    return data;
  }, [saveAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem('vibesync_token');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  // Deprecated: socket connection is entirely managed by SocketContext now
  // to prevent race conditions during React mounts
  useEffect(() => {
    // intentionally left blank to prevent removing hooks completely
  }, [token, user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, guestLogin, otpLogin, sendOtp, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
