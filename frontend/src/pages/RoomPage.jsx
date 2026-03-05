import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { joinRoom } from '../services/api';
import VideoPlayer from '../components/VideoPlayer/VideoPlayer';
import ChatPanel from '../components/Chat/ChatPanel';
import ParticipantsList from '../components/Participants/ParticipantsList';
import VoiceControls from '../components/Voice/VoiceControls';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { Tv2, Copy, Users, MessageSquare, ChevronLeft, Crown, Wifi, WifiOff, LogOut, Trash2, Clock, ShieldCheck, ShieldOff, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { createPortal } from 'react-dom';

const RoomPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();
  const {
    room, participants, joinRoom: socketJoin, leaveRoom, isHost, reactions, deleteRoom,
    joinStatus, joinRequests, requiresApproval, transferHost,
    approveJoin, denyJoin, setApprovalRequired, refreshParticipants,
    roomEndedByHost, dismissRoomEnded,
  } = useRoom();

  const [sidebarTab, setSidebarTab] = useState('chat');
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const hasJoinedRef = useRef(false);

  // Reset join guard when socket changes (new token / reconnect)
  useEffect(() => {
    hasJoinedRef.current = false;
  }, [socket]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }
    if (!socket || !isConnected) return;
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    // Listen for username conflict error from backend
    const onJoinError = ({ message }) => {
      setError(message);
      setJoining(false);
    };
    socket.on('room:join-error', onJoinError);

    const init = async () => {
      try {
        const password = location.state?.password;
        await joinRoom(code, password);
        socketJoin(code);
        // After joining, explicitly request fresh participant list
        // (fixes 'no participants visible' on rejoin / server restart)
        setTimeout(() => refreshParticipants(), 800);
        setJoining(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not join room');
        setJoining(false);
      }
    };

    init();

    return () => {
      socket.off('room:join-error', onJoinError);
      leaveRoom();
    };
  }, [socket, isConnected, isAuthenticated]);

  // Track whether we've ever received a room:state (guards against false-positive redirect)
  const hasEverHadRoom = useRef(false);
  useEffect(() => { if (room) hasEverHadRoom.current = true; }, [room]);

  // Ghost-room guard: only fires after the room was real and became null
  // (e.g. deleted, kicked, or user presses Back to a dead room URL)
  useEffect(() => {
    if (!joining && !room && !error && hasEverHadRoom.current) {
      navigate('/', { replace: true });
    }
  }, [room, joining, error]);

  // Refresh participant list when switching to participants tab
  const handleTabChange = useCallback((tab) => {
    setSidebarTab(tab);
    if (tab === 'participants') refreshParticipants();
  }, [refreshParticipants]);

  // Show join-request approval toasts for host
  useEffect(() => {
    if (!isHost || joinRequests.length === 0) return;
    const req = joinRequests[joinRequests.length - 1];
    // Show a persistent toast with approve/deny actions
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">🔔 <strong>{req.username}</strong> wants to join</p>
          <div className="flex gap-2">
            <button
              onClick={() => { approveJoin(req.userId); toast.dismiss(t.id); }}
              className="flex items-center gap-1 bg-accent-green/20 text-accent-green px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-accent-green/30 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => { denyJoin(req.userId); toast.dismiss(t.id); }}
              className="flex items-center gap-1 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Deny
            </button>
          </div>
        </div>
      ),
      { duration: 30000, id: `join-req-${req.userId}` }
    );
  }, [joinRequests, isHost]);

  const copyRoomCode = () => navigator.clipboard.writeText(code).then(() => toast.success('Room code copied!'));
  const copyRoomLink = () => navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied!'));

  const handleLeave = () => {
    if (isHost) {
      const others = participants.filter(
        (p) => p.userId !== user?.id && p.isOnline !== false
      );
      if (others.length > 0) {
        setShowLeaveModal(true);
        return;
      }
    }
    leaveRoom();
    navigate('/', { replace: true });
  };

  const confirmLeave = (transferToUserId) => {
    if (transferToUserId) transferHost(transferToUserId);
    setTimeout(() => { leaveRoom(); navigate('/', { replace: true }); }, transferToUserId ? 300 : 0);
  };

  const handleDeleteRoom = () => setShowDeleteConfirm(true);

  // Pending approval waiting screen
  if (!joining && joinStatus === 'pending') {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <div className="card text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-accent-purple/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Clock className="w-9 h-9 text-accent-purple" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Waiting for Approval</h2>
          <p className="text-text-secondary text-sm mb-4">
            The host needs to approve your request to join <strong>{code}</strong>.
          </p>
          <div className="flex gap-1.5 justify-center mb-6">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2.5 h-2.5 rounded-full bg-accent-purple/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <button className="btn-ghost text-sm" onClick={() => { leaveRoom(); navigate('/'); }}>Cancel</button>
        </div>
      </div>
    );
  }

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
      <header className="flex items-center justify-between px-3 py-2 border-b border-border-dark bg-bg-secondary shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md bg-accent-red flex items-center justify-center">
              <Tv2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-black text-gradient-red hidden sm:block">VibeSync</span>
          </button>
          <div className="w-px h-5 bg-border-dark" />
          <h1 className="text-sm font-bold text-text-primary truncate">{room?.name || code}</h1>
          {isHost && (
            <span className="badge bg-accent-yellow/10 text-accent-yellow hidden md:flex">
              <Crown className="w-3 h-3" /> Host
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`items-center gap-1.5 text-xs hidden sm:flex
            ${isConnected ? 'text-accent-green' : 'text-red-400'}`}>
            {isConnected
              ? <><Wifi className="w-3.5 h-3.5" /> Live</>
              : <><WifiOff className="w-3.5 h-3.5" /> Reconnecting…</>}
          </div>
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 bg-bg-hover hover:bg-bg-card border border-border-dark
                       rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-text-primary transition-all"
            title="Click to copy room code"
          >
            <span className="text-text-muted hidden xs:inline">CODE</span>
            <span className="text-accent-purple tracking-widest">{code}</span>
            <Copy className="w-3 h-3 text-text-muted" />
          </button>
          <button onClick={copyRoomLink} className="btn-ghost text-xs py-1.5 px-3 hidden sm:flex">
            Share
          </button>

          {/* Leave Room */}
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 btn-ghost text-xs py-1.5 px-2.5 text-text-muted hover:text-red-400 transition-colors"
            title="Leave room"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          {/* Delete Room (host only) */}
          {isHost && (
            <button
              onClick={handleDeleteRoom}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all"
              title="Delete room"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      {/* Mobile: video on top, sidebar below   |   Desktop: side-by-side */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ── Video area ── */}
        {/* Mobile: fixed height so chat is visible | Desktop: fills remaining width */}
        <div className="h-[42vw] min-h-[200px] md:h-auto md:flex-1 bg-black relative overflow-hidden shrink-0">
          <VideoPlayer />
          {/* Floating emoji reactions */}
          <div className="absolute bottom-16 left-4 pointer-events-none z-30">
            {reactions.map((r) => (
              <div key={r.id} className="reaction-float absolute text-3xl select-none" style={{ bottom: 0 }}>
                {r.emoji}
              </div>
            ))}
          </div>
        </div>

        {/* ── Sidebar ── */}
        {/* Mobile: full-width flex-1 (fills remaining height) | Desktop: fixed 320px */}
        <aside className="flex-1 md:flex-none md:w-80 xl:w-96 flex flex-col bg-bg-secondary md:border-l border-t md:border-t-0 border-border-dark overflow-hidden">
          {/* Sidebar tabs */}
          <div className="flex border-b border-border-dark shrink-0">
            {[
              { id: 'chat', icon: MessageSquare, label: 'Chat' },
              { id: 'participants', icon: Users, label: `People (${participants?.length || 0})` },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all duration-200
                  ${sidebarTab === id
                    ? 'border-accent-red text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary'}`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {id === 'participants' && joinRequests.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-accent-red text-white text-xs flex items-center justify-center">
                    {joinRequests.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Host: approval mode toggle (below tab bar, visible on participants tab) */}
          {isHost && sidebarTab === 'participants' && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-dark bg-bg-primary/50 shrink-0">
              <div className="flex items-center gap-2">
                {requiresApproval
                  ? <ShieldCheck className="w-4 h-4 text-accent-green" />
                  : <ShieldOff className="w-4 h-4 text-text-muted" />}
                <span className="text-xs font-semibold text-text-secondary">
                  {requiresApproval ? 'Approval ON' : 'Approval OFF'}
                </span>
                {requiresApproval && joinRequests.length > 0 && (
                  <span className="text-xs text-accent-yellow font-semibold">
                    ({joinRequests.length} waiting)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setApprovalRequired(!requiresApproval)}
                className={`relative inline-flex w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 shrink-0 ${
                  requiresApproval ? 'bg-accent-green' : 'bg-bg-hover border border-border-dark'
                }`}
                title={requiresApproval ? 'Disable approval' : 'Enable approval'}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  requiresApproval ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          )}

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {sidebarTab === 'chat' && <ChatPanel />}
            {sidebarTab === 'participants' && <ParticipantsList />}
          </div>

          {/* Voice controls */}
          <VoiceControls />
        </aside>
      </div>

      {/* Delete room confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Room?"
        message="This will end the session for all participants and cannot be undone."
        confirmLabel="Delete Room"
        danger
        onConfirm={() => { deleteRoom(); navigate('/', { replace: true }); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* ── Room Ended by Host modal (persistent — user must click OK) ── */}
      {roomEndedByHost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card text-center max-w-sm w-full shadow-2xl border border-border-light">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <h2 className="text-xl font-black text-text-primary mb-2">Session Ended</h2>
            <p className="text-text-secondary text-sm mb-1">
              {roomEndedByHost.message}
            </p>
            <p className="text-text-muted text-xs mb-7">You have been returned to the home screen.</p>

            <button
              type="button"
              onClick={() => {
                dismissRoomEnded();
                navigate('/', { replace: true });
              }}
              className="btn-primary w-full py-3 text-base font-bold"
            >
              OK, Got It
            </button>
          </div>
        </div>
      )}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-yellow/10 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">Transfer Host Before Leaving</h2>
                <p className="text-xs text-text-muted mt-0.5">Pick a new host, or leave anyway</p>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto scroll-area mb-4">
              {participants
                .filter(p => p.userId !== user?.id && p.isOnline !== false)
                .map(p => (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => { setShowLeaveModal(false); confirmLeave(p.userId); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-bg-hover hover:bg-accent-purple/10 hover:border-accent-purple/30 border border-transparent transition-all text-left"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: p.avatar || '#8b5cf6' }}
                    >
                      {p.username?.slice(0, 2)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{p.username}</p>
                      <p className="text-xs text-text-muted">{p.isGuest ? 'Guest' : 'Member'}</p>
                    </div>
                    <Crown className="w-4 h-4 text-accent-yellow opacity-60" />
                  </button>
                ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="btn-ghost flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowLeaveModal(false); confirmLeave(null); }}
                className="flex items-center justify-center gap-1.5 flex-1 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors"
              >
                <LogOut className="w-4 h-4" /> Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomPage;
