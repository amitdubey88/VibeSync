'use client';

import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { Toaster } from 'react-hot-toast';

/**
 * Global client providers — single 'use client' boundary.
 * AuthProvider handles JWT-based auth from localStorage.
 * Room-scoped providers (SocketProvider, RoomProvider, WebRTCProvider)
 * live in app/room/[code]/RoomClient.tsx, not here.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
        <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'rgba(10, 10, 11, 0.95)',
            color: '#f4f4f5',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0px',
            fontSize: '13px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(30px)',
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: '700',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0a0a0b' } },
          error: { iconTheme: { primary: '#e11d48', secondary: '#f4f4f5' } },
        }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
