import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { joinRoom } from '../services/api';
import VideoPlayer from '../components/VideoPlayer/VideoPlayer';
import SyncStatusBadge from '../components/VideoPlayer/SyncStatusBadge';
import QuickReactionBar from '../components/VideoPlayer/QuickReactionBar';
import ChatPanel from '../components/Chat/ChatPanel';
import ParticipantsList from '../components/Participants/ParticipantsList';
import VoiceControls from '../components/Voice/VoiceControls';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import EnergyMeter from '../components/UI/EnergyMeter';
import ActivityFeed from '../components/Sidebar/ActivityFeed';
import Tooltip from '../components/UI/Tooltip';
import { Tv2, Copy, Users, MessageSquare, ChevronLeft, Crown, Wifi, WifiOff, LogOut, Clock, ShieldCheck, ShieldOff, CheckCircle, XCircle, Lock, Unlock, PanelRightClose, PanelRightOpen, Loader2, Info, Activity, MoreVertical, Trash, Palette, ListVideo, ShieldAlert, Link, Radio, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import RoomSkeleton from '../components/UI/RoomSkeleton';
import WatchQueue from '../components/Sidebar/WatchQueue';

import SessionSummaryModal from '../components/UI/SessionSummaryModal';
import KeyboardShortcutsPanel from '../components/UI/KeyboardShortcutsPanel';
import CountdownLobby from '../components/UI/CountdownLobby';
import ThemePicker from '../components/UI/ThemePicker';
import OfflineShell from '../components/UI/OfflineShell';
import { useRoomTheme } from '../hooks/useRoomTheme';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const LiveTimeTracker = ({ videoState, currentVideo }) => {
  const [displayTime, setDisplayTime] = useState(0);

  useEffect(() => {
    if (!videoState || currentVideo?.type === 'live' || currentVideo?.type === 'uploading') {
      const timer = setTimeout(() => setDisplayTime(0), 0);
      return () => clearTimeout(timer);
    }
    let raf;
    const update = () => {
      let t = videoState.currentTime || 0;
      if (videoState.isPlaying && videoState.lastUpdated) {
        const elapsed = (Date.now() - videoState.lastUpdated) / 1000;
        t += elapsed;
      }
      setDisplayTime(t);
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [videoState, currentVideo]);

  if (currentVideo?.type === 'live' || currentVideo?.type === 'uploading') {
    return <span className="text-obsidian-primary font-bold animate-pulse">LIVE</span>;
  }
  return <span>⏱ {formatTime(displayTime)}</span>;
};

const RoomPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, guestLogin } = useAuth();
  const { socket, isConnected } = useSocket();
  const {
    room, participants, joinRoom: socketJoin, leaveRoom, isHost, deleteRoom,
    joinStatus, joinRequests, requiresApproval, transferHost,
    approveJoin, denyJoin, setApprovalRequired, refreshParticipants,
    roomEndedByHost, dismissRoomEnded,
    sessionSummary, setSessionSummary,
    unreadChatCount, setUnreadChatCount, chatMuted, setChatMuted,
    isLocked, videoState, currentVideo,
    hostAway,
  } = useRoom();

  const onlineCount = participants.filter(p => p.isOnline !== false).length;

  const [sidebarTab, setSidebarTab] = useState('chat');
  const [activeMobileTab, setActiveMobileTab] = useState('chat'); // For mobile layout
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarDimmed, setIsSidebarDimmed] = useState(false);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isGuestPromptVisible, setIsGuestPromptVisible] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isNameConfirmed, setIsNameConfirmed] = useState(() => {
    const saved = sessionStorage.getItem("vibesync_session");
    if (!saved) return false;
    try {
      const session = JSON.parse(saved);
      return session.roomCode === code;
    } catch { return false; }
  });
  const hasJoinedRef = useRef(false);

  // Initialize features
  useRoomTheme();
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia ? window.matchMedia('(max-width: 767px)').matches : window.innerWidth < 768;
  });

  // Keep mobile/desktop layout reactive on resize/orientation changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;

    const update = () => {
      setIsMobile(mql ? mql.matches : window.innerWidth < 768);
    };

    update();
    if (mql && typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('video:toggle-play'));
          break;
        case 'f':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('video:toggle-fullscreen'));
          break;
        case 'm':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('video:toggle-mute'));
          break;
        case 'c':
          setSidebarTab('chat');
          setActiveMobileTab('chat');
          if (!isSidebarOpen) setIsSidebarOpen(true);
          break;
        case 'p':
          setSidebarTab('participants');
          setActiveMobileTab('people');
          if (!isSidebarOpen) setIsSidebarOpen(true);
          break;
        case '?':
          setShowShortcutsHelp(true);
          break;
        case '/':
          e.preventDefault();
          setSidebarTab('chat');
          setActiveMobileTab('chat');
          if (!isSidebarOpen) setIsSidebarOpen(true);
          // Wait for sidebar to open then focus
          setTimeout(() => {
            document.querySelector('.chat-input')?.focus();
          }, 100);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Cinematic dimming listener
  useEffect(() => {
    const onControlsVisibility = (e) => {
      setIsSidebarDimmed(!e.detail);
    };
    window.addEventListener('video:controls-visibility', onControlsVisibility);
    return () => window.removeEventListener('video:controls-visibility', onControlsVisibility);
  }, []);

  // Reset join guard when socket changes or disconnects (e.g. laptop wakes up)
  // so we can re-verify and re-join the room upon reconnection.
  useEffect(() => {
    // Reset join guard when socket changes/disconnects OR room code changes
    if (!socket || !isConnected) {
      hasJoinedRef.current = false;
    }
  }, [socket, isConnected, code]);

  useEffect(() => {
    if (!isNameConfirmed) {
      setIsGuestPromptVisible(true);
      if (user?.username && !guestName) setGuestName(user.username);
      return;
    }
    setIsGuestPromptVisible(false);
    if (!socket || !isConnected) return;
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    // Remove before adding to ensure idempotency on reconnect cycles (BUG-9)
    const onJoinError = ({ message }) => {
      setError(message);
      setJoining(false);
    };
    socket.off('room:join-error', onJoinError);
    socket.on('room:join-error', onJoinError);

    const init = async () => {
      try {
        const password = location.state?.password;
        const query = new URLSearchParams(location.search);
        const inviteToken = query.get('t');
        await joinRoom(code, password, inviteToken);
        socketJoin(code);
        // After joining, explicitly request fresh participant list
        // (fixes 'no participants visible' on rejoin / server restart)
        setTimeout(() => refreshParticipants(), 800);
        
        sessionStorage.setItem("vibesync_session", JSON.stringify({
          roomCode: code,
          username: user?.username,
          joinedAt: Date.now()
        }));

        setJoining(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not join room');
        setJoining(false);
      }
    };

    init();

    return () => {
      socket.off('room:join-error', onJoinError);
    };
  }, [
    socket,
    isConnected,
    isAuthenticated,
    code,
    location.state?.password,
    socketJoin,
    refreshParticipants,
    navigate,
    user?.username,
    isNameConfirmed,
    guestName,
    location.search,
  ]);

  // Leave room on component unmount (page navigation away).
  // Kept separate so it only fires once when the component truly unmounts,
  // not on every reconnect cycle.
  const leaveRoomRef = useRef(leaveRoom);
  useEffect(() => { leaveRoomRef.current = leaveRoom; }, [leaveRoom]);
  useEffect(() => {
    return () => { leaveRoomRef.current(false); }; // false = soft leave (temporary disconnect)
  }, []);

  // Track whether we've ever received a room:state (guards against false-positive redirect)
  const hasEverHadRoom = useRef(false);
  const ghostRedirectTimer = useRef(null);
  const roomRef = useRef(room); // always-current ref to avoid stale closures in setTimeout
  useEffect(() => {
    roomRef.current = room;
    if (room) hasEverHadRoom.current = true;
  }, [room]);

  // Redirect to home if room ended
  useEffect(() => {
    // If we have a sessionSummary, don't redirect yet (wait for modal dismiss)
    if (roomEndedByHost && !sessionSummary) {
      console.log('[RoomPage] Room ended by host, clearing session and redirecting.');
      sessionStorage.removeItem("vibesync_session");
      dismissRoomEnded();
      navigate('/', { replace: true, state: { roomEnded: roomEndedByHost.message || "Session Ended" } });
    }
  }, [roomEndedByHost, sessionSummary, navigate, dismissRoomEnded]);

  // Ghost-room guard: only fires after the room was real and became null.
  // We debounce by 4 seconds to allow socket reconnection to restore the room
  // before we redirect (avoids kicking users on temporary disconnects).
  useEffect(() => {
    if (!joining && !room && !error && hasEverHadRoom.current && !sessionSummary) {
      ghostRedirectTimer.current = setTimeout(() => {
        // Re-check via ref: if room has been restored by reconnect, don't redirect
        if (!roomRef.current && hasEverHadRoom.current) {
          navigate('/', { replace: true });
        }
      }, 4000);
    } else {
      // Room is back (reconnected) — cancel any pending redirect
      if (ghostRedirectTimer.current) {
        clearTimeout(ghostRedirectTimer.current);
        ghostRedirectTimer.current = null;
      }
    }
    return () => {
      if (ghostRedirectTimer.current) {
        clearTimeout(ghostRedirectTimer.current);
        ghostRedirectTimer.current = null;
      }
    };
  }, [room, joining, error, sessionSummary, navigate]);

  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);

  useNavigationGuard({
    enabled: !!room,
    onAttempt: () => {
      setShowRefreshConfirm(true);
    }
  });

  // Refresh participant list when switching to participants tab
  const handleTabChange = useCallback((tab) => {
    setSidebarTab(tab);
    if (tab === 'participants') refreshParticipants();
    if (tab === 'chat') setUnreadChatCount(0); // clear unread count when viewing chat
  }, [refreshParticipants, setUnreadChatCount]);

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
  }, [joinRequests, isHost, approveJoin, denyJoin]);

  const copyRoomCode = () => navigator.clipboard.writeText(code).then(() => toast.success('Room code copied!'));
  
  const copyRoomLink = () => {
    // Construct the absolute backend invite URL for rich OG previews
    // In production, VITE_API_URL should be the full backend domain (e.g. https://api.vibesync.live)
    const backendBase = import.meta.env.VITE_API_URL || window.location.origin.replace('5173', '5000');
    const inviteUrl = `${backendBase}/invite/${code}`;
    
    navigator.clipboard.writeText(inviteUrl).then(() => {
      toast.success('Invite link (with preview) copied!', {
        icon: <Link className="w-5 h-5 text-obsidian-primary" />,
        duration: 3000
      });
    });
  };

  const handleGuestJoin = async () => {
    if (!guestName.trim()) return;
    setIsLoggingIn(true);
    try {
      // Re-login only if name changed or not authenticated
      if (!isAuthenticated || user?.username !== guestName.trim()) {
        await guestLogin(guestName.trim());
      }
      
      // Save session to bypass prompt on refresh/redirect
      sessionStorage.setItem("vibesync_session", JSON.stringify({
        roomCode: code,
        username: guestName.trim(),
        joinedAt: Date.now()
      }));
      
      setIsNameConfirmed(true);
      toast.success(`Welcome, ${guestName}!`, { 
        icon: <User className="w-5 h-5 text-accent-purple" /> 
      });
    } catch {
      toast.error('Failed to join. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLeave = (e) => {
    // If Shift key is pressed, bypass confirmation
    if (e?.shiftKey) {
      executeLeave();
      return;
    }

    // BUG-14: Block host from leaving mid-live-stream
    if (isHost && currentVideo?.type === 'live') {
      toast.error('Stop your live stream before leaving the room.', {
        icon: <Radio className="w-5 h-5 text-red-500" />,
        duration: 3000,
      });
      return;
    }

    if (isHost) {
      const others = participants.filter(
        (p) => p.userId !== user?.id && p.isOnline !== false
      );
      if (others.length === 1) {
        // Auto-transfer to the only other participant before leaving
        transferHost(others[0].userId);
        setTimeout(() => { leaveRoom(true); navigate('/', { replace: true }); }, 100);
        return;
      } else if (others.length > 1) {
        // Must explicitly choose host
        setShowLeaveModal(true);
        return;
      }
    }
    
    // For non-hosts or if no others online, show confirmation
    setShowConfirmLeave(true);
  };

  const executeLeave = () => {
    sessionStorage.removeItem("vibesync_session");
    leaveRoom(true);
    navigate('/', { replace: true });
  };

  const confirmLeave = (transferToUserId) => {
    sessionStorage.removeItem("vibesync_session");
    if (transferToUserId) transferHost(transferToUserId);
    setTimeout(() => { leaveRoom(true); navigate('/', { replace: true }); }, transferToUserId ? 300 : 0);
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
          <h2 className="text-xl font-bold text-white mb-2">Waiting for Approval</h2>
          <p className="text-obsidian-on-surface-variant text-sm mb-4">
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

  if (sessionSummary) {
    return (
      <div className="min-h-screen gradient-bg">
        <SessionSummaryModal 
          summary={sessionSummary} 
          onClose={() => {
            setSessionSummary(null);
            sessionStorage.removeItem("vibesync_session");
            navigate('/', { replace: true });
          }} 
        />
      </div>
    );
  }

  if (isGuestPromptVisible) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500 min-h-screen overflow-y-auto">
        <div className="absolute top-12 flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-obsidian-primary to-obsidian-primary-dim flex items-center justify-center shadow-lg shadow-obsidian-primary/20 overflow-hidden relative p-2">
            <img src="/favicon-cinematic.png" alt="VibeSync Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">VibeSync</h1>
        </div>
        
        <div className="w-full max-w-md bg-[#0a0a0b]/80 border border-white/5 p-8  backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.9)] relative overflow-hidden my-auto">
          {/* Background Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-obsidian-primary/20 rounded-full blur-[80px]" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-obsidian-primary/80/20 rounded-full blur-[80px]" />

          <div className="relative z-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to the Party!</h2>
            <p className="text-white/50 text-sm mb-8">You've been invited to join <span className="text-white font-semibold">{code}</span>. What should we call you?</p>

            <div className="space-y-4">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="YOUR ALIAS (REQUIRED)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guestName.trim() && !isLoggingIn && handleGuestJoin()}
                  className="w-full h-14 bg-transparent border-0 border-b border-obsidian-outline-variant py-4 px-0 text-white font-headline placeholder:text-neutral-600 focus:ring-0 focus:border-obsidian-primary transition-all uppercase tracking-widest text-base"
                  autoFocus
                />
              </div>

              <button
                onClick={handleGuestJoin}
                disabled={!guestName.trim() || isLoggingIn}
                className="w-full py-5 bg-obsidian-surface-high border border-obsidian-outline-variant text-white font-headline font-bold tracking-widest uppercase hover:border-obsidian-primary/50 hover:bg-obsidian-surface-highest hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Join Party <Tv2 className="w-4 h-4 ml-1" /></>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <p className="fixed bottom-8 text-white/20 text-[10px] uppercase tracking-[0.2em] font-bold">Secure • Real-time • Synchronized</p>
      </div>
    );
  }

  if (joining || (!room && !error)) {
    return <RoomSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <div className="card text-center max-w-sm">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-white mb-2">Can't Join Room</h2>
          <p className="text-obsidian-on-surface-variant text-sm mb-6">{error}</p>
          <button 
            className="btn-primary w-full" 
            onClick={() => {
              console.log('[RoomPage] Join error, clearing session and returning home.');
              sessionStorage.removeItem("vibesync_session");
              navigate('/', { replace: true });
            }}
          >
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-obsidian-background text-obsidian-on-surface font-body overflow-hidden">
      <CountdownLobby />
      <OfflineShell />

      {/* ── Top bar ── */}
      <header className="flex justify-between items-center px-4 md:px-6 h-16 w-full border-b border-white/10 dark:border-white/5 bg-[#0a0a0b]/80 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-b border-white/5 shrink-0 gap-2 relative z-[100]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 shrink-0 group"
          >
            <img
              src="/favicon-192.png"
              alt="VibeSync Logo"
              className="w-8 h-8 object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_10px_rgba(189,157,255,0.4)]"
            />
            <span className="text-xl font-bold tracking-tighter text-obsidian-primary font-headline uppercase hidden sm:block">
              VIBESYNC
            </span>
          </button>

          <div className="w-px h-5 bg-white/10 mx-1 md:mx-2 hidden sm:block" />

          <h1 className="text-sm font-headline font-bold uppercase tracking-widest text-obsidian-primary truncate max-w-[120px] sm:max-w-[200px] border-b border-obsidian-primary/30 pb-0.5">
            {room?.name || code}
          </h1>

          <div className="hidden lg:flex flex-col border-l border-white/10 pl-4 mx-2 animate-fade-in max-w-[200px]">
            <span className="text-[9px] text-obsidian-on-surface-variant font-bold font-headline uppercase tracking-[0.2em]">
              Now Watching
            </span>
            <span className="text-[11px] font-bold text-white truncate">
              {currentVideo?.title || "Untitled Video"}
            </span>
          </div>

          <div className="hidden xs:flex items-center gap-1.5 bg-[#13131a] px-3 py-1 border border-white/5 shadow-inner ml-2">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-green" />
            <span className="text-[9px] font-bold font-headline uppercase tracking-widest text-obsidian-on-surface-variant">
              E2EE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] font-bold font-headline tracking-widest uppercase shrink-0">
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-accent-green" />{" "}
                <span className="hidden xs:inline text-accent-green">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />{" "}
                <span className="hidden sm:inline text-red-400">Wait</span>
              </>
            )}
          </div>

          <div className="hidden md:block w-px h-5 bg-white/10 mx-1" />

          <div className="hidden xl:flex items-center px-3 border-r border-white/10 mr-1">
            <EnergyMeter />
          </div>

          <div className="hidden md:flex items-center gap-2 bg-[#13131a] px-4 py-1.5 border border-white/5 shadow-inner shrink min-w-0">
            <span className="flex items-center gap-1.5 shrink-0 text-obsidian-on-surface-variant text-[10px] font-bold font-headline uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-obsidian-primary animate-pulse shadow-[0_0_8px_rgba(189,157,255,0.8)]"></span>
              {participants.filter((p) => p.isOnline !== false).length}
            </span>
            {isLocked && (
              <Lock className="w-3 h-3 text-red-400 shrink-0 ml-1" />
            )}
            <span className="truncate shrink text-[10px] font-bold font-headline tracking-widest text-obsidian-primary/80 ml-2 border-l border-white/10 pl-2">
              <LiveTimeTracker
                videoState={videoState}
                currentVideo={currentVideo}
              />
            </span>
          </div>

          {isHost && (
            <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1 bg-accent-yellow/10 border border-accent-yellow/30 rounded-sm animate-fade-in shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <Crown className="w-3.5 h-3.5 text-accent-yellow drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
              <span className="text-[9px] font-bold font-headline text-accent-yellow uppercase tracking-widest">
                Host
              </span>
            </div>
          )}

          <div className="w-px h-5 bg-white/10 mx-1 hidden md:block" />

          <Tooltip text="Copy room code" position="bottom">
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-1.5 bg-transparent hover:bg-white/5 border border-white/5 px-3 py-1.5 shadow-lg text-[10px] font-bold font-headline transition-all uppercase tracking-widest group"
            >
              <span className="text-obsidian-on-surface-variant group-hover:text-obsidian-primary hidden sm:inline">
                CODE
              </span>
              <span className="text-obsidian-primary group-hover:text-obsidian-primary-dim">
                {code}
              </span>
              <Copy className="w-3.5 h-3.5 text-obsidian-on-surface-variant group-hover:text-obsidian-primary" />
            </button>
          </Tooltip>

          <Tooltip text="Copy invite link" position="bottom">
            <button
              onClick={copyRoomLink}
              className="bg-obsidian-primary hover:bg-obsidian-primary-dim text-obsidian-on-primary-fixed px-3 py-1.5 rounded text-[10px] font-bold font-headline uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(189,157,255,0.2)] hover:shadow-[0_0_20px_rgba(189,157,255,0.4)] hidden sm:flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">
                link
              </span>
              Invite
            </button>
          </Tooltip>

          <div className="hidden md:block relative z-[100]">
            <Tooltip text="More Options" position="bottom">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={`text-obsidian-on-surface-variant hover:text-obsidian-primary transition-colors p-1.5 rounded bg-transparent ${isMoreMenuOpen ? "bg-obsidian-primary/10 text-obsidian-primary" : ""}`}
                onBlur={() => setTimeout(() => setIsMoreMenuOpen(false), 250)}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </Tooltip>
            {isMoreMenuOpen && (
              <div className="absolute top-full right-0 mt-3 w-56 bg-[#0a0a0b]/95 backdrop-blur-3xl border border-white/5 shadow-[0_30px_60px_rgba(0,0,0,0.9)] overflow-hidden z-[100] animate-fade-in origin-top-right">
                <div className="flex flex-col py-2">
                  <button
                    onClick={() => setShowShortcutsHelp(true)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-headline tracking-wider uppercase text-obsidian-on-surface-variant hover:text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Shortcuts
                  </button>
                  {isHost && (
                    <button
                      onClick={() => setShowThemePicker(true)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-headline tracking-wider uppercase text-obsidian-on-surface-variant hover:text-white hover:bg-white/5 transition-colors text-left"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      Theater Theme
                    </button>
                  )}
                  {isHost && (
                    <>
                      <div className="h-px bg-white/5 my-1 mx-2" />
                      <button
                        onClick={handleDeleteRoom}
                        className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-headline tracking-wider uppercase text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-left font-bold"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        End Session
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            <ThemePicker
              isOpen={showThemePicker}
              onClose={() => setShowThemePicker(false)}
            />
          </div>

          <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />

          <Tooltip text="Leave Room (Shift+Click to skip)" position="bottom">
            <button
              onClick={(e) => handleLeave(e)}
              className="flex items-center gap-1.5 py-1.5 px-3 border border-transparent hover:border-red-500/30 hover:bg-red-500/10 text-obsidian-outline hover:text-red-400 transition-all font-headline text-[10px] font-bold uppercase tracking-widest"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Leave</span>
            </button>
          </Tooltip>

          <Tooltip
            text={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            position="bottom"
          >
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-obsidian-on-surface-variant hover:text-obsidian-primary transition-colors hidden md:flex items-center justify-center p-1.5 hover:bg-obsidian-primary/10 ml-2"
            >
              {isSidebarOpen ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
        </div>
      </header>

      {/* ── Main content ── */}
      {/* Mobile: video on top, sidebar below   |   Desktop: side-by-side */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video area ── */}
        {/* Mobile: aspect ratio 16:9 | Desktop: fills remaining width */}
        <div className="aspect-video md:aspect-auto md:flex-1 bg-black md:bg-obsidian-surface-container-lowest relative group overflow-hidden shrink-0 border-r border-white/5 shadow-2xl">
          <VideoPlayer />

          {/* Reconnection Banner */}
          {!isConnected && (
            <div className="absolute top-0 left-0 right-0 z-50 animate-slide-up">
              <div className="bg-red-600/80 backdrop-blur-2xl border-b border-red-500/30 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
                <WifiOff className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-bold tracking-wide uppercase">
                  Connection lost. Attempting to reconnect...
                </span>
              </div>
            </div>
          )}

          {/* Host Away Banner — shown to all participants when host disconnects temporarily (BUG-13) */}
          {hostAway && !isHost && (
            <div className="absolute top-0 left-0 right-0 z-40 animate-slide-up">
              <div className="bg-amber-600/80 backdrop-blur-2xl border-b border-amber-500/30 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
                <span className="text-base">⚠️</span>
                <span className="text-xs font-bold tracking-wide uppercase">
                  Host disconnected — Waiting for them to return…
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Tab Switcher Overlay (only on mobile) */}
        <div className="md:hidden flex flex-col bg-[#0a0a0b]/90 backdrop-blur-3xl border-t border-white/5 shadow-[0_-20px_50px_rgba(0,0,0,0.9)] shrink-0 z-40 relative">
          <div className="flex w-full overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveMobileTab("chat")}
              className={`min-w-[70px] flex-1 flex flex-col items-center justify-center py-1.5 text-[10px] font-bold transition-all ${activeMobileTab === "chat" ? "text-obsidian-primary" : "text-obsidian-outline opacity-60"}`}
            >
              <MessageSquare className="w-4.5 h-4.5 mb-1" />
              <span>CHAT</span>
              {unreadChatCount > 0 && (
                <span className="absolute top-2.5 right-[calc(50%-18px)] w-2 h-2 bg-accent-purple rounded-full shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
              )}
            </button>
            <button
              onClick={() => setActiveMobileTab("people")}
              className={`min-w-[70px] flex-1 flex flex-col items-center justify-center py-1.5 text-[10px] font-bold transition-all ${activeMobileTab === "people" ? "text-obsidian-primary" : "text-obsidian-outline opacity-60"}`}
            >
              <Users className="w-4.5 h-4.5 mb-1" />
              <span>PEOPLE ({onlineCount})</span>
              {joinRequests.length > 0 && (
                <span className="absolute top-2.5 right-[calc(50%-22px)] w-2 h-2 bg-obsidian-primary/80 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveMobileTab("queue")}
              className={`min-w-[70px] flex-1 flex flex-col items-center justify-center py-1.5 text-[10px] font-bold transition-all ${activeMobileTab === "queue" ? "text-obsidian-primary" : "text-obsidian-outline opacity-60"}`}
            >
              <ListVideo className="w-4.5 h-4.5 mb-1" />
              <span>QUEUE</span>
            </button>
            <button
              onClick={() => setActiveMobileTab("activity")}
              className={`min-w-[70px] flex-1 flex flex-col items-center justify-center py-1.5 text-[10px] font-bold transition-all ${activeMobileTab === "activity" ? "text-obsidian-primary" : "text-obsidian-outline opacity-60"}`}
            >
              <Activity className="w-4.5 h-4.5 mb-1" />
              <span>ACTIVITY</span>
            </button>
          </div>
        </div>

        {/* ── Sidebar ── */}
        {/* Mobile: flex-1 height but only shows one tab at a time | Desktop: animated width */}
        <aside
          onMouseMove={() => {
            // Wake up sidebar if user hovers over it
            window.dispatchEvent(
              new CustomEvent("video:controls-visibility", { detail: true }),
            );
          }}
          className={`flex flex-col bg-[#0a0a0b]/95 border-l border-t md:border-t-0 border-white/5 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500 ease-in-out shrink-0
          ${isSidebarOpen ? "flex-1 md:flex-none md:w-80 xl:w-[380px]" : "h-0 md:w-0 md:border-l-0 opacity-0 overflow-hidden"}
          ${isSidebarDimmed && isSidebarOpen ? "md:opacity-30 hover:opacity-100" : "opacity-100"}`}
        >
          {/* Desktop Sidebar tabs (hidden on mobile) */}
          <div className="hidden md:flex border-b border-white/5 shrink-0 px-4 pt-4 justify-between bg-[#0a0a0b]">
            {[
              { id: "chat", icon: MessageSquare, label: "Chat" },
              {
                id: "participants",
                icon: Users,
                label: `People (${participants?.length || 0})`,
              },
              { id: "queue", icon: ListVideo, label: "Queue" },
              { id: "activity", icon: Activity, label: "Activity" },
            ].map(({ id, icon: Icon, label }) => {
              const TabIcon = Icon;
              return (
                <button
                  key={id}
                  onClick={() => handleTabChange(id)}
                  className={`font-headline uppercase text-xs tracking-widest font-bold pb-2 transition-colors relative flex items-center gap-2 ${sidebarTab === id ? "text-obsidian-primary" : "text-obsidian-on-surface-variant hover:text-white"}`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span className="hidden xl:inline">{label}</span>
                  {sidebarTab === id && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-obsidian-primary shadow-[0_0_10px_rgba(189,157,255,0.5)]"></div>
                  )}
                  {id === "chat" &&
                    unreadChatCount > 0 &&
                    sidebarTab !== "chat" && (
                      <span
                        key={unreadChatCount}
                        className="w-4 h-4 rounded-full bg-accent-purple text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(139,92,246,0.6)] animate-badge-bounce"
                      >
                        {unreadChatCount > 9 ? "9+" : unreadChatCount}
                      </span>
                    )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Tab Logic: Hybrid Mobile/Desktop */}
            {sidebarTab === "chat" ||
            (activeMobileTab === "chat" && isMobile) ? (
              <div
                key={sidebarTab}
                className={`flex-1 flex flex-col overflow-hidden animate-tab-fade ${isMobile && activeMobileTab !== "chat" ? "hidden" : "flex"}`}
              >
                <ChatPanel chatMuted={chatMuted} setChatMuted={setChatMuted} />
              </div>
            ) : null}

            {sidebarTab === "participants" ||
            (activeMobileTab === "people" && isMobile) ? (
              <div
                key={sidebarTab}
                className={`flex-1 flex flex-col overflow-hidden animate-tab-fade ${isMobile && activeMobileTab !== "people" ? "hidden" : "flex"}`}
              >
                {/* Host: controls sidebar block */}
                {isHost && (
                  <div className="flex flex-col gap-3 px-4 py-3 border-b border-white/10 bg-bg-primary/50 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {requiresApproval ? (
                          <ShieldCheck className="w-4 h-4 text-accent-green" />
                        ) : (
                          <ShieldOff className="w-4 h-4 text-obsidian-outline" />
                        )}
                        <span className="text-xs font-semibold text-obsidian-on-surface-variant">
                          {requiresApproval ? "Approval ON" : "Approval OFF"}
                        </span>
                      </div>
                      <button
                        onClick={() => setApprovalRequired(!requiresApproval)}
                        className={`relative inline-flex w-11 h-6 rounded-full overflow-hidden transition-colors ${requiresApproval ? "bg-accent-green" : "bg-obsidian-surface-container-high"}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${requiresApproval ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  </div>
                )}
                <ParticipantsList />
              </div>
            ) : null}

            {sidebarTab === "activity" ||
            (activeMobileTab === "activity" && isMobile) ? (
              <div
                key={sidebarTab}
                className={`flex-1 flex flex-col overflow-hidden animate-tab-fade ${isMobile && activeMobileTab !== "activity" ? "hidden" : "flex"}`}
              >
                <ActivityFeed />
              </div>
            ) : null}

            {sidebarTab === "queue" ||
            (activeMobileTab === "queue" && isMobile) ? (
              <div
                key={sidebarTab}
                className={`flex-1 flex flex-col overflow-hidden animate-tab-fade ${isMobile && activeMobileTab !== "queue" ? "hidden" : "flex"}`}
              >
                <WatchQueue />
              </div>
            ) : null}
          </div>

          {/* Voice controls */}
          <VoiceControls />
        </aside>
      </div>

      {/* Leave confirmation */}
      <ConfirmDialog
        open={showConfirmLeave}
        title="Leave Room?"
        message="You will disconnect from the watch session. Are you sure you want to leave?"
        confirmLabel="Leave Room"
        danger
        onConfirm={executeLeave}
        onCancel={() => setShowConfirmLeave(false)}
      />

      {/* Room Info Modal */}
      <ConfirmDialog
        open={showRoomInfo}
        title="Room Information"
        message={
          <div className="flex flex-col gap-4 text-left py-2">
            <div>
              <label className="text-[10px] font-bold text-obsidian-outline uppercase tracking-wider">
                Room Name
              </label>
              <div className="text-sm font-semibold text-white">
                {room?.name || "VibeSync Party"}
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-obsidian-outline uppercase tracking-wider">
                  Room ID
                </label>
                <div className="text-sm font-mono font-bold text-accent-purple">
                  {code}
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-obsidian-outline uppercase tracking-wider">
                  Security
                </label>
                <div className="text-sm font-semibold text-accent-green flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Encrypted
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-obsidian-outline uppercase tracking-wider">
                Invite Link
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  readOnly
                  value={window.location.href}
                  className="flex-1 bg-black/30 border border-white/5 px-3 py-1.5 shadow-lg text-xs text-obsidian-on-surface-variant outline-none focus:border-accent-purple/50"
                />
                <button
                  onClick={copyRoomLink}
                  className="btn-ghost p-1.5 h-auto"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        }
        confirmLabel="Close"
        onConfirm={() => setShowRoomInfo(false)}
        onCancel={() => setShowRoomInfo(false)}
      />

      {/* Shortcuts Help Modal */}
      <KeyboardShortcutsPanel
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Delete room confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Room?"
        message="This will end the session for all participants and cannot be undone."
        confirmLabel="Delete Room"
        danger
        onConfirm={() => {
          deleteRoom();
          setShowDeleteConfirm(false);
          // Redirect is handled by onRoomDeleted in RoomContext
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Refresh confirmation during live stream */}
      <ConfirmDialog
        open={showRefreshConfirm}
        title="Leave Live Session?"
        message="You are currently in an active live stream. Leaving or refreshing will disconnect you."
        confirmLabel="Leave Anyway"
        danger
        onConfirm={() => {
          setShowRefreshConfirm(false);
          // Set flag so the reload detector doesn't think it was an accident
          sessionStorage.setItem(`reloaded_${code}`, "true");
          window.location.reload();
        }}
        onCancel={() => setShowRefreshConfirm(false)}
      />

      {/* ── Room Ended by Host modal moved to LandingPage ── */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-fade-in">
          <div className="bg-[#0a0a0b]/90 backdrop-blur-3xl border border-white/5 p-8 shadow-[0_30px_60px_rgba(0,0,0,0.9)] w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent-yellow/10 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Transfer Host Before Leaving
                </h2>
                <p className="text-xs text-obsidian-outline mt-0.5">
                  Pick a new host to continue the session.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto scroll-area mb-4">
              {participants
                .filter((p) => p.userId !== user?.id && p.isOnline !== false)
                .map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => {
                      setShowLeaveModal(false);
                      confirmLeave(p.userId);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#13131a] hover:bg-accent-purple/10 hover:border-accent-purple/30 border border-white/5 shadow-lg transition-all text-left"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: p.avatar || "#8b5cf6" }}
                    >
                      {p.username?.slice(0, 2)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {p.username}
                      </p>
                      <p className="text-xs text-obsidian-outline">
                        {p.isGuest ? "Guest" : "Member"}
                      </p>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default RoomPage;
