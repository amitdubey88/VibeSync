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
import EnergyMeter from '../components/UI/EnergyMeter';
import ActivityFeed from '../components/Sidebar/ActivityFeed';
import Tooltip from '../components/UI/Tooltip';
import { Tv2, Copy, Users, MessageSquare, ChevronLeft, Crown, Wifi, WifiOff, LogOut, Clock, ShieldCheck, ShieldOff, CheckCircle, XCircle, Lock, Unlock, PanelRightClose, PanelRightOpen, Loader2, Info, Activity, MoreVertical, Trash } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import RoomSkeleton from '../components/UI/RoomSkeleton';

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
      setDisplayTime(0);
      return;
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
    return <span className="text-accent-red font-bold animate-pulse">LIVE</span>;
  }
  return <span>⏱ {formatTime(displayTime)}</span>;
};

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
    unreadChatCount, setUnreadChatCount, chatMuted, setChatMuted,
    setUserStatus, isLocked, toggleRoomLock, videoState, currentVideo,
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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const hasJoinedRef = useRef(false);
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
    if (!isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }
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
        await joinRoom(code, password);
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
    if (roomEndedByHost) {
      dismissRoomEnded();
      navigate('/', { replace: true, state: { roomEnded: roomEndedByHost.message } });
    }
  }, [roomEndedByHost, navigate, dismissRoomEnded]);

  // Ghost-room guard: only fires after the room was real and became null.
  // We debounce by 4 seconds to allow socket reconnection to restore the room
  // before we redirect (avoids kicking users on temporary disconnects).
  useEffect(() => {
    if (!joining && !room && !error && hasEverHadRoom.current) {
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
  }, [room, joining, error]);

  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);

  useNavigationGuard({
    enabled: !!room,
    onAttempt: (type) => {
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
  }, [joinRequests, isHost]);

  const copyRoomCode = () => navigator.clipboard.writeText(code).then(() => toast.success('Room code copied!'));
  const copyRoomLink = () => navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied!'));

  const handleLeave = (e) => {
    // If Shift key is pressed, bypass confirmation
    if (e?.shiftKey) {
      executeLeave();
      return;
    }

    // BUG-14: Block host from leaving mid-live-stream
    if (isHost && currentVideo?.type === 'live') {
      toast.error('Stop your live stream before leaving the room.', {
        icon: '📡',
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

  if (joining || (!room && !error)) {
    return <RoomSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <div className="card text-center max-w-sm">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Can't Join Room</h2>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <button 
            className="btn-primary w-full" 
            onClick={() => {
              sessionStorage.removeItem("vibesync_session");
              navigate('/');
            }}
          >
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-cinematic overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border-dark glass-panel shrink-0 gap-2 relative z-[100]">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0">
            <img src="/favicon.svg" alt="VibeSync Logo" className="w-7 h-7 rounded-md shadow-[0_0_10px_rgba(229,9,20,0.4)]" />
            <span className="text-sm font-black text-gradient-red hidden sm:block">VibeSync</span>
          </button>
          <div className="w-px h-5 bg-border-dark" />
          <h1 className="text-sm font-bold text-text-primary truncate max-w-[120px] sm:max-w-xs text-left">{room?.name || code}</h1>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 text-[10px] font-bold uppercase tracking-wider hidden sm:flex shrink-0">
            <ShieldCheck className="w-3 h-3" />
            E2EE
          </div>
          
          {/* Now Watching Banner */}
          {currentVideo && (
            <div className="hidden lg:flex flex-col border-l border-border-dark pl-4 ml-2 animate-fade-in max-w-[200px]">
              <span className="text-[10px] text-text-muted font-black uppercase tracking-widest">Now Watching</span>
              <span className="text-xs font-bold text-text-primary truncate">{currentVideo.title || 'Untitled Video'}</span>
            </div>
          )}

          <div className="w-px h-5 bg-border-dark hidden md:block" />
          
          {/* Energy Meter */}
          <div className="hidden md:flex items-center px-3 border-r border-border-dark mr-2">
            <EnergyMeter />
          </div>

          <div className="flex items-center gap-3 text-[11px] text-text-muted font-medium bg-white/5 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md shadow-inner max-w-full overflow-hidden shrink-0">
            <span className="flex items-center gap-1.5 shrink-0">
              <Users className="w-3 h-3 text-accent-purple" /> 
              {participants.filter(p => p.isOnline !== false).length}
            </span>
            {isLocked && <Lock className="w-2.5 h-2.5 text-red-400 shrink-0" />}
            <span className="truncate shrink-0"><LiveTimeTracker videoState={videoState} currentVideo={currentVideo} /></span>
          </div>

          {isHost && (
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-accent-yellow/10 border border-accent-yellow/30 rounded-full animate-fade-in shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <Crown className="w-3.5 h-3.5 text-accent-yellow drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
              <span className="text-[10px] font-bold text-accent-yellow uppercase tracking-widest">Host</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 text-xs shrink-0
            ${isConnected ? 'text-accent-green' : 'text-red-400'}`}>
            {isConnected
              ? <><Wifi className="w-3.5 h-3.5" /> <span>Live</span></>
              : <><WifiOff className="w-3.5 h-3.5 animate-pulse" /> <span className="hidden sm:inline">Reconnecting…</span></>}
          </div>
          <Tooltip text="Copy room code" position="bottom">
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-1.5 bg-bg-hover hover:bg-bg-card border border-border-dark
                         rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-text-primary transition-all active:scale-95"
            >
              <span className="text-text-muted hidden xs:inline">CODE</span>
              <span className="text-accent-purple tracking-widest">{code}</span>
              <Copy className="w-3 h-3 text-text-muted" />
            </button>
          </Tooltip>
          <Tooltip text="Copy invite link" position="bottom">
            <button onClick={copyRoomLink} className="btn-ghost text-xs py-1.5 px-3 hidden sm:flex">
              Share
            </button>
          </Tooltip>

          {/* Toggle Sidebar */}
          <Tooltip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="btn-ghost text-xs py-1.5 px-2.5 hidden md:flex items-center gap-1.5 text-text-muted hover:text-white"
            >
              {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          </Tooltip>

          {/* More Menu Dropdown */}
          <div className="relative z-[100]">
            <Tooltip text="More Options" position="bottom">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={`btn-ghost text-xs p-1.5 transition-colors ${isMoreMenuOpen ? 'text-white bg-white/10' : 'text-text-muted hover:text-white'}`}
                onBlur={() => {
                  // Small delay to allow clicking on menu items
                  setTimeout(() => setIsMoreMenuOpen(false), 250);
                }}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </Tooltip>
            
            {isMoreMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-bg-card border border-border-dark rounded-xl shadow-modal overflow-hidden z-[100] animate-fade-in origin-top-right">
                <div className="flex flex-col py-1">
                  <button
                    onClick={() => setShowShortcutsHelp(true)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-left"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Keyboard Shortcuts
                  </button>
                  
                  {isHost && (
                    <>
                      <div className="h-px bg-border-dark my-1 mx-2" />
                      <button
                        onClick={handleDeleteRoom}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:text-white hover:bg-red-500/80 transition-colors text-left font-bold"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        End Session (Delete)
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Leave Room */}
          <Tooltip text="Leave Room (Shift+Click to skip)" position="bottom">
            <button
              onClick={(e) => handleLeave(e)}
              className="flex items-center gap-1.5 btn-ghost text-xs py-1.5 px-2.5 text-text-muted hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </Tooltip>
        </div>
      </header>
      
      {/* Animated gradient accent line */}
      <div className="gradient-line shrink-0" />

      {/* ── Main content ── */}
      {/* Mobile: video on top, sidebar below   |   Desktop: side-by-side */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* Video area ── */}
        {/* Mobile: aspect ratio 16:9 | Desktop: fills remaining width */}
        <div className="aspect-video md:aspect-auto md:flex-1 bg-black relative overflow-hidden shrink-0">
          <VideoPlayer />
          
          {/* Reconnection Banner */}
          {!isConnected && (
            <div className="absolute top-0 left-0 right-0 z-50 animate-slide-up">
              <div className="bg-red-600/90 backdrop-blur-md text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
                <WifiOff className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-bold tracking-wide uppercase">Connection lost. Attempting to reconnect...</span>
              </div>
            </div>
          )}

          {/* Host Away Banner — shown to all participants when host disconnects temporarily (BUG-13) */}
          {hostAway && !isHost && (
            <div className="absolute top-0 left-0 right-0 z-40 animate-slide-up">
              <div className="bg-amber-600/90 backdrop-blur-md text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
                <span className="text-base">⚠️</span>
                <span className="text-xs font-bold tracking-wide uppercase">Host disconnected — Waiting for them to return…</span>
              </div>
            </div>
          )}
          
        </div>

        {/* Mobile Tab Switcher Overlay (only on mobile) */}
        <div className="md:hidden flex bg-bg-secondary/90 backdrop-blur-md border-t border-border-dark shadow-[0_-4px_12px_rgba(0,0,0,0.5)] shrink-0 z-40">
          <button 
            onClick={() => setActiveMobileTab('chat')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 text-[10px] font-bold transition-all ${activeMobileTab === 'chat' ? 'text-accent-red' : 'text-text-muted opacity-60'}`}
          >
            <MessageSquare className="w-4.5 h-4.5 mb-1" />
            <span>CHAT</span>
            {unreadChatCount > 0 && <span className="absolute top-2.5 right-[calc(50%-18px)] w-2 h-2 bg-accent-purple rounded-full shadow-[0_0_8px_rgba(139,92,246,0.8)]" />}
          </button>
          <button 
            onClick={() => setActiveMobileTab('people')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 text-[10px] font-bold transition-all ${activeMobileTab === 'people' ? 'text-accent-red' : 'text-text-muted opacity-60'}`}
          >
            <Users className="w-4.5 h-4.5 mb-1" />
            <span>PEOPLE ({onlineCount})</span>
            {joinRequests.length > 0 && <span className="absolute top-2.5 right-[calc(50%-22px)] w-2 h-2 bg-accent-red rounded-full" />}
          </button>
        </div>

        {/* ── Sidebar ── */}
        {/* Mobile: flex-1 height but only shows one tab at a time | Desktop: animated width */}
        <aside 
          onMouseMove={() => {
            // Wake up sidebar if user hovers over it
            window.dispatchEvent(new CustomEvent('video:controls-visibility', { detail: true }));
          }}
          className={`flex flex-col glass-panel md:border-l border-t md:border-t-0 border-border-dark overflow-hidden transition-all duration-500 ease-in-out shrink-0
          ${isSidebarOpen ? 'flex-1 md:flex-none md:w-80 xl:w-96' : 'h-0 md:w-0 md:border-l-0 opacity-0 overflow-hidden'}
          ${isSidebarDimmed && isSidebarOpen ? 'md:opacity-30 hover:opacity-100' : 'opacity-100'}`}
        >
          {/* Desktop Sidebar tabs (hidden on mobile) */}
          <div className="hidden md:flex border-b border-border-dark shrink-0">
            {[
              { id: 'chat', icon: MessageSquare, label: 'Chat' },
              { id: 'participants', icon: Users, label: `People (${participants?.length || 0})` },
              { id: 'activity', icon: Activity, label: 'Activity' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all duration-200
                  ${sidebarTab === id
                    ? 'border-accent-red text-text-primary bg-white/5'
                    : 'border-transparent text-text-muted hover:text-text-secondary'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden xl:inline">{label}</span>
                {id === 'chat' && unreadChatCount > 0 && sidebarTab !== 'chat' && (
                  <span
                    key={unreadChatCount}
                    className="w-4 h-4 rounded-full bg-accent-purple text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(139,92,246,0.6)] animate-badge-bounce"
                  >
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Tab Logic: Hybrid Mobile/Desktop */}
            {(sidebarTab === 'chat' || (activeMobileTab === 'chat' && isMobile)) ? (
              <div key={sidebarTab} className={`flex-1 flex flex-col overflow-hidden animate-tab-fade ${(isMobile && activeMobileTab !== 'chat') ? 'hidden' : 'flex'}`}>
                <ChatPanel chatMuted={chatMuted} setChatMuted={setChatMuted} />
              </div>
            ) : null}
            
            {(sidebarTab === 'participants' || (activeMobileTab === 'people' && isMobile)) ? (
              <div key={sidebarTab} className={`flex-1 flex flex-col overflow-hidden animate-tab-fade ${(isMobile && activeMobileTab !== 'people') ? 'hidden' : 'flex'}`}>
                {/* Host: controls sidebar block */}
                {isHost && (
                  <div className="flex flex-col gap-3 px-4 py-3 border-b border-border-dark bg-bg-primary/50 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {requiresApproval ? <ShieldCheck className="w-4 h-4 text-accent-green" /> : <ShieldOff className="w-4 h-4 text-text-muted" />}
                        <span className="text-xs font-semibold text-text-secondary">{requiresApproval ? 'Approval ON' : 'Approval OFF'}</span>
                      </div>
                      <button onClick={() => setApprovalRequired(!requiresApproval)} className={`relative inline-flex w-11 h-6 rounded-full overflow-hidden transition-colors ${requiresApproval ? 'bg-accent-green' : 'bg-bg-hover'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${requiresApproval ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )}
                <ParticipantsList />
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
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Room Name</label>
              <div className="text-sm font-semibold text-text-primary">{room?.name || 'VibeSync Party'}</div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Room ID</label>
                <div className="text-sm font-mono font-bold text-accent-purple">{code}</div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Security</label>
                <div className="text-sm font-semibold text-accent-green flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Encrypted
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Invite Link</label>
              <div className="flex items-center gap-2 mt-1">
                <input 
                  readOnly 
                  value={window.location.href}
                  className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-text-secondary outline-none focus:border-accent-purple/50"
                />
                <button onClick={copyRoomLink} className="btn-ghost p-1.5 h-auto">
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
      <ConfirmDialog
        open={showShortcutsHelp}
        title="Keyboard Shortcuts"
        message={
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-left py-2">
            <div className="flex justify-between border-b border-border-light pb-1"><span className="font-mono text-accent-purple bg-accent-purple/10 px-1.5 rounded">Space</span> <span className="text-xs">Play/Pause</span></div>
            <div className="flex justify-between border-b border-border-light pb-1"><span className="font-mono text-accent-purple bg-accent-purple/10 px-1.5 rounded">F</span> <span className="text-xs">Fullscreen</span></div>
            <div className="flex justify-between border-b border-border-light pb-1"><span className="font-mono text-accent-purple bg-accent-purple/10 px-1.5 rounded">M</span> <span className="text-xs">Mute</span></div>
            <div className="flex justify-between border-b border-border-light pb-1"><span className="font-mono text-accent-purple bg-accent-purple/10 px-1.5 rounded">C</span> <span className="text-xs">Chat Tab</span></div>
            <div className="flex justify-between border-b border-border-light pb-1"><span className="font-mono text-accent-purple bg-accent-purple/10 px-1.5 rounded">P</span> <span className="text-xs">People Tab</span></div>
            <div className="flex justify-between border-b border-border-light pb-1"><span className="font-mono text-accent-purple bg-accent-purple/10 px-1.5 rounded">/</span> <span className="text-xs">Focus Chat</span></div>
          </div>
        }
        confirmLabel="Got it"
        onConfirm={() => setShowShortcutsHelp(false)}
        onCancel={() => setShowShortcutsHelp(false)}
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
          sessionStorage.setItem(`reloaded_${code}`, 'true');
          window.location.reload();
        }}
        onCancel={() => setShowRefreshConfirm(false)}
      />

      {/* ── Room Ended by Host modal moved to LandingPage ── */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-yellow/10 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">Transfer Host Before Leaving</h2>
                <p className="text-xs text-text-muted mt-0.5">Pick a new host to continue the session.</p>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomPage;
