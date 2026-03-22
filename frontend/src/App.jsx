import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { RoomProvider } from './context/RoomContext';
import { WebRTCProvider } from './context/WebRTCContext';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';

// Guard: redirect to home if not authenticated
const ProtectedRoom = () => {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-rose-500 border-t-transparent animate-spin shadow-[0_0_15px_rgba(225,29,72,0.5)]" />
      </div>
    );
  }
  return <RoomPage />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route
      path="/room/:code"
      element={
        <SocketProvider>
          <RoomProvider>
            <WebRTCProvider>
              <ProtectedRoom />
            </WebRTCProvider>
          </RoomProvider>
        </SocketProvider>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'rgba(10, 10, 11, 0.95)',
            color: '#f4f4f5',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            fontSize: '14px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(24px)',
            fontFamily: 'Outfit, Inter, sans-serif',
            fontWeight: '600',
            letterSpacing: '0.025em'
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0a0a0b' } },
          error: { iconTheme: { primary: '#e11d48', secondary: '#f4f4f5' } },
        }}
      />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
