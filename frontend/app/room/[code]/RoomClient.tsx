'use client';

import { SocketProvider } from '../../../src/context/SocketContext';
import { RoomProvider } from '../../../src/context/RoomContext';
import { WebRTCProvider } from '../../../src/context/WebRTCContext';
import RoomPage from '../../../src/views/RoomPage';
import { useAuth } from '../../../src/context/AuthContext';

/**
 * Client boundary for room-scoped providers.
 * Mirrors the provider nesting order from the original App.jsx:
 *   SocketProvider > RoomProvider > WebRTCProvider > RoomPage
 *
 * The loading spinner replaces <ProtectedRoom> from App.jsx.
 */
function RoomClient({ code: _code }: { code: string }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-rose-500 border-t-transparent animate-spin shadow-[0_0_15px_rgba(225,29,72,0.5)]" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <RoomProvider>
        <WebRTCProvider>
          <RoomPage />
        </WebRTCProvider>
      </RoomProvider>
    </SocketProvider>
  );
}

export default RoomClient;
