import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { RoomProvider } from './context/RoomContext';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';

// Guard: redirect to home if not authenticated
const ProtectedRoom = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-accent-red border-t-transparent animate-spin" />
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
            <ProtectedRoom />
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
          style: {
            background: '#13131f',
            color: '#f1f1f1',
            border: '1px solid #1e1e30',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#f1f1f1' } },
          error: { iconTheme: { primary: '#e50914', secondary: '#f1f1f1' } },
        }}
      />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
