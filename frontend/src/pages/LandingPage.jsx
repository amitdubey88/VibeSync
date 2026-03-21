import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRoom, getRoomInfo } from '../services/api';
import toast from 'react-hot-toast';
import { Play, Users, Lock, Globe, ArrowRight, Tv2, Zap, MessageSquare, Mic, Puzzle, ShieldCheck, LogIn, PlusCircle, Calendar, Ban } from 'lucide-react';

const LandingPage = () => {
  const { user, guestLogin, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState('join');
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState('public');
  const [password, setPassword] = useState('');
  const [scheduleToggle, setScheduleToggle] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill username from stored session — only if field is still empty
  useEffect(() => {
    if (user?.username && !username) setUsername(user.username);
  }, [user]); // eslint-disable-line

  // Auto-rejoin last active room if user accidentally disconnected
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get('kicked')) {
      toast.error('You have been removed from the room by the host.', {
        id: 'kicked-toast',
        duration: 5000,
        icon: <Ban className="w-5 h-5 text-red-500" />
      });
      // Clean up the URL
      navigate('/', { replace: true });
      return;
    }

    const saved = sessionStorage.getItem("vibesync_session");
    // Don't auto-rejoin if they explicitly left or host ended it
    if (saved && !location.state?.roomEnded) {
      try {
        const session = JSON.parse(saved);
        if (session.roomCode) {
          navigate(`/room/${session.roomCode}`, { replace: true });
        }
      } catch {
        sessionStorage.removeItem("vibesync_session");
      }
    }
  }, [navigate, location.state]);

  // ── Ensure user is logged in with chosen username ────────────────────────
  const ensureAuth = async () => {
    const name = username.trim();
    if (!name) { toast.error('Please enter your name first'); return false; }
    if (name.length < 2) { toast.error('Name must be at least 2 characters'); return false; }

    // If already authed with the SAME username, reuse session
    if (isAuthenticated && user?.username === name) return true;

    // Different username OR not logged in → issue a fresh guest token
    if (isAuthenticated) logout();
    
    // Retry mechanism for transient network or DB ready-state issues
    let attempts = 0;
    while (attempts < 3) {
      try {
        await guestLogin(name);
        return true;
      } catch (err) {
        attempts++;
        if (attempts >= 3) {
          toast.error(err.response?.data?.message || 'Login failed');
          return false;
        }
        // Wait 400ms before retrying
        await new Promise(r => setTimeout(r, 400));
      }
    }
    return false;
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return toast.error('Enter a room code');
    setLoading(true);
    try {
      const ok = await ensureAuth();
      if (!ok) return;
      const { room } = await getRoomInfo(roomCode.toUpperCase().trim());
      navigate(`/room/${room.code}`, { state: { password } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Room not found');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return toast.error('Enter a room name');
    setLoading(true);
    try {
      const ok = await ensureAuth();
      if (!ok) return;
      const { room } = await createRoom({
        name: roomName.trim(),
        type: roomType,
        password: roomType === 'private' ? password : undefined,
        scheduledAt: scheduleToggle && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      toast.success('Room created!');
      navigate(`/room/${room.code}`, { state: { password } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cinematic flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="VibeSync Logo" className="w-8 h-8 rounded-lg shadow-[0_0_15px_rgba(229,9,20,0.4)]" />
          <span className="text-xl font-black tracking-tight text-gradient-red">VibeSync</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-text-muted text-sm">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            Real-time sync
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            End-to-End Encrypted
          </div>
        </div>
      </header>

      {/* ── Room Ended by Host Modal ── */}
      {location.state?.roomEnded && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card text-center max-w-sm w-full shadow-2xl border border-border-light">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-text-primary mb-2">Session Ended</h2>
            <p className="text-gray-300 text-sm mb-1">{location.state.roomEnded}</p>
            <p className="text-text-muted text-xs mb-7">You have been returned to the home screen.</p>
            <button
              type="button"
              onClick={() => {
                // Clear the state so it doesn't show up again on refresh
                navigate('/', { replace: true, state: {} });
              }}
              className="btn-primary w-full py-3 text-base font-bold"
            >
              OK, Got It
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 px-6 py-8 max-w-6xl mx-auto w-full">
        {/* Left: Hero text */}
        <div className="flex-1 text-center lg:text-left animate-slide-up">
          <div className="inline-flex items-center gap-2 bg-accent-red/10 border border-accent-red/20 rounded-full px-4 py-1.5 text-sm text-accent-red font-medium mb-6">
            <Zap className="w-3.5 h-3.5" /> Zero-latency watch party
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-text-primary leading-tight mb-4">
            Watch Together,<br />
            <span className="text-gradient-red">In Perfect Sync</span>
          </h1>
          <p className="text-text-secondary text-lg mb-8 max-w-lg">
            Host a room, invite friends, and watch any video in real-time sync —
            with live chat and voice call, as if you're all in the same room.
          </p>
          <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
            {[
              { icon: Play, label: 'Instant Sync' },
              { icon: MessageSquare, label: 'Live Chat' },
              { icon: Mic, label: 'Voice Call' },
              { icon: ShieldCheck, label: 'E2EE' },
              { icon: Users, label: 'Multi-user' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-text-secondary">
                <item.icon className="w-4 h-4 text-accent-purple" />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Auth + Room form */}
        <div className="w-full max-w-md animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="card">

            {/* ── Username ── always editable, never a static chip */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Your Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className={`input w-full ${!username ? 'border-red-500/40 focus:border-red-500/60' : ''}`}
                placeholder="Your name (required)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                autoComplete="off"
              />
              {!username && (
                <p className="text-xs text-red-400/80 mt-1.5">Choose a display name to continue</p>
              )}
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-xl bg-bg-hover p-1 mb-5">
              {['join', 'create'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                    ${tab === t ? 'bg-accent-red text-white shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {t === 'join' ? <><LogIn className="w-4 h-4" /> Join Room</> : <><PlusCircle className="w-4 h-4" /> Create Room</>}
                </button>
              ))}
            </div>

            {/* Join form */}
            {tab === 'join' && (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Room Code
                  </label>
                  <input
                    type="text"
                    className="input font-mono text-lg tracking-widest uppercase"
                    placeholder="ABC123"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Password (if private)
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Leave blank if not needed"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary w-full text-base py-3" disabled={loading}>
                  {loading ? 'Joining…' : <><ArrowRight className="w-4 h-4" /> Join Room</>}
                </button>
              </form>
            )}

            {/* Create form */}
            {tab === 'create' && (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Room Name
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Movie Night, Anime Club…"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Room Type
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: 'public', icon: Globe, label: 'Public' },
                      { value: 'private', icon: Lock, label: 'Private' },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setRoomType(item.value)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all
                          ${roomType === item.value
                            ? 'border-accent-purple bg-accent-purple/10 text-accent-purple'
                            : 'border-border-dark text-text-secondary hover:border-border-light'}`}
                      >
                        <item.icon className="w-4 h-4" /> {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                {roomType === 'private' && (
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Room Password
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Set a password for your room"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}
                
                {/* Feature 13: Scheduled Rooms */}
                <div className="pt-2 border-t border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary hover:text-white transition-colors">
                    <input 
                      type="checkbox" 
                      checked={scheduleToggle} 
                      onChange={(e) => setScheduleToggle(e.target.checked)}
                      className="rounded border-border-dark bg-black/50 text-accent-purple focus:ring-accent-purple/50 w-4 h-4 cursor-pointer"
                    />
                    <Calendar className="w-4 h-4" /> Schedule for later
                  </label>
                  {scheduleToggle && (
                    <div className="mt-3 animate-fade-in pl-6">
                      <input
                        type="datetime-local"
                        className="input text-sm w-full py-2"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                      <p className="text-[10px] text-gray-500 mt-1.5 uppercase tracking-wider">
                        A full-screen countdown will be shown to joiners until this time.
                      </p>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn-primary w-full text-base py-3" disabled={loading}>
                  {loading ? 'Creating…' : <><Play className="w-4 h-4" /> Create Room</>}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-text-muted text-xs mt-4">
            No account needed · Join as guest instantly
          </p>
        </div>
      </main>

      {/* ── About & Credits ── */}
      <section className="w-full border-t border-border-dark bg-bg-primary/40 backdrop-blur-sm py-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs font-bold mb-4 uppercase tracking-widest">
            Behind the Scenes
          </div>
          <h2 className="text-2xl font-black text-text-primary mb-4 text-gradient-red">About VibeSync</h2>
          <p className="text-text-secondary text-base leading-relaxed max-w-2xl mx-auto mb-10">
            VibeSync is a premium co-watching platform designed to bring people together, no matter the distance. 
            Whether it's a YouTube marathon, a direct video link, or a live stream, our high-performance 
            engine ensures that every frame, every chat message, and every voice is in perfect harmony.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { title: 'Zero Lag', desc: 'Ultra-low latency streaming' },
              { title: 'Privacy First', desc: 'End-to-End Encrypted sessions' },
              { title: 'Pure Sync', desc: 'Frame-accurate playback' }
            ].map((f) => (
              <div key={f.title} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-accent-purple font-bold text-sm mb-1">{f.title}</p>
                <p className="text-text-muted text-xs">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-border-dark to-transparent mb-8" />
          
          <p className="text-text-muted text-sm tracking-wide">
            This application is a labor of love, meticulously crafted with passion by <span className="text-text-primary font-bold">Amit Dubey</span>.
          </p>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
