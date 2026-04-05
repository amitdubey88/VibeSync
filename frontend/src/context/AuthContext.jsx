'use client';

import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { loginAsGuest, verifyOtp, sendOtp } from '../services/api';
import { disconnectSocket } from '../services/socket';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('vibesync_token') : null
  );
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.removeItem('vibesync_token');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setUser({ id: payload.id, username: payload.username, avatar: payload.avatar, isGuest: payload.isGuest });
        } else {
          logout();
        }
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, [token, logout]);

  const saveAuth = useCallback((data) => {
    const { token: t, user: u } = data;
    if (typeof window !== 'undefined') localStorage.setItem('vibesync_token', t);
    setToken(t);
    setUser(u);
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};


