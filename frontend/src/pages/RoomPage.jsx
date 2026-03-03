import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { joinRoom } from '../services/api';
import VideoPlayer from '../components/VideoPlayer/VideoPlayer';
import ChatPanel from '../components/Chat/ChatPanel';
import ParticipantsList from '../components/Participants/ParticipantsList';
import VoiceControls from '../components/Voice/VoiceControls';
import { Tv2, Copy, Users, MessageSquare, ChevronLeft, Crown, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';

const RoomPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();
  const { room, joinRoom: socketJoin, leaveRoom, isHost, reactions } = useRoom();

  const [sidebarTab, setSidebarTab] = useState('chat'); // 'chat' | 'participants'
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }
    if (!socket || !isConnected) return;
    if (hasJoinedRef.current) return; // Prevent double-join
    hasJoinedRef.current = true;

    const init = async () => {
      try {
        const password = location.state?.password;
        await joinRoom(code, password);
        socketJoin(code);
        setJoining(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not join room');
        setJoining(false);
      }
    };

    init();

    return () => {
      leaveRoom();
    };
  }, [socket, isConnected, isAuthenticated]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(code).then(() => toast.success('Room code copied!'));
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied!'));
  };

  if (joining) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-accent-red border-t-transparent animate-spin" />
          <p className="text-text-secondary">Joining room…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <div className="card text-center max-w-sm">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Can't Join Room</h2>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <button className="btn-primary w-full" onClick={() => navigate('/')}>
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border-dark bg-bg-secondary shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md bg-accent-red flex items-center justify-center">
              <Tv2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-black text-gradient-red hidden sm:block">VibeSync</span>
          </button>

          <div className="w-px h-5 bg-border-dark" />

          {/* Room name */}
          <h1 className="text-sm font-bold text-text-primary truncate">{room?.name || code}</h1>

          {/* Host badge */}
          {isHost && (
            <span className="badge bg-accent-yellow/10 text-accent-yellow hidden md:flex">
              <Crown className="w-3 h-3" /> Host
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-xs hidden sm:flex
            ${isConnected ? 'text-accent-green' : 'text-red-400'}`}>
            {isConnected
              ? <><Wifi className="w-3.5 h-3.5" /> Live</>
              : <><WifiOff className="w-3.5 h-3.5" /> Reconnecting…</>}
          </div>

          {/* Room code chip */}
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-2 bg-bg-hover hover:bg-bg-card border border-border-dark
                       rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-text-primary transition-all"
            title="Click to copy room code"
          >
            <span className="text-text-muted">CODE</span>
            <span className="text-accent-purple tracking-widest">{code}</span>
            <Copy className="w-3 h-3 text-text-muted" />
          </button>

          <button onClick={copyRoomLink} className="btn-ghost text-xs py-1.5 px-3 hidden sm:flex">
            Share Link
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Video area (left 70%) ── */}
        <div className="flex-1 min-w-0 bg-black relative overflow-hidden">
          <VideoPlayer />

          {/* Floating emoji reactions */}
          <div className="absolute bottom-24 left-6 pointer-events-none z-30">
            {reactions.map((r) => (
              <div key={r.id} className="reaction-float absolute text-3xl select-none" style={{ bottom: 0 }}>
                {r.emoji}
              </div>
            ))}
          </div>
        </div>

        {/* ── Sidebar (right 30%, min 300px) ── */}
        <aside className="w-80 xl:w-96 flex flex-col bg-bg-secondary border-l border-border-dark shrink-0">
          {/* Sidebar tabs */}
          <div className="flex border-b border-border-dark shrink-0">
            {[
              { id: 'chat', icon: MessageSquare, label: 'Chat' },
              { id: 'participants', icon: Users, label: `People (${room?.participants?.length || 0})` },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setSidebarTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all duration-200
                  ${sidebarTab === id
                    ? 'border-accent-red text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden xs:block">{label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {sidebarTab === 'chat' && <ChatPanel />}
            {sidebarTab === 'participants' && <ParticipantsList />}
          </div>

          {/* Voice controls always visible at bottom */}
          <VoiceControls />
        </aside>
      </div>
    </div>
  );
};

export default RoomPage;
