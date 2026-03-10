import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRoom, getRoomInfo } from '../services/api';
import toast from 'react-hot-toast';
import { Play, Users, Lock, Globe, ArrowRight, Tv2, Zap, MessageSquare, Mic, Puzzle, ShieldCheck } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);

  // Pre-fill username from stored session — only if field is still empty
  useEffect(() => {
    if (user?.username && !username) setUsername(user.username);
  }, [user]); // eslint-disable-line

  // Auto-rejoin last active room if user accidentally disconnected
  useEffect(() => {
    const saved = sessionStorage.getItem("vibesync_session");
    // Don't auto-rejoin if they explicitly left or host ended it
    if (saved && !location.state?.roomEnded) {
      try {
        const session = JSON.parse(saved);
        if (session.roomCode) {
          navigate(`/room/${session.roomCode}`, { replace: true });
        }
      } catch (e) {
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
    try {
      await guestLogin(name);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
      return false;
    }
  };

  // ── Apply inline username edit ────────────────────────────────────────────
  const applyUsernameEdit = async () => {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error('Username must be at least 2 characters');
      return;
    }
    setUsername(trimmed);
    setEditingUsername(false);
    // Force re-login with the new name immediately
    if (isAuthenticated) {
      try {
        logout();
        await guestLogin(trimmed);
        toast.success(`Username changed to "${trimmed}"`);
      } catch {}
    }
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
    <div className="min-h-screen gradient-bg flex flex-col">
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
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-text-secondary">
                <Icon className="w-4 h-4 text-accent-purple" />
                {label}
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
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                    ${tab === t ? 'bg-accent-red text-white shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {t === 'join' ? '🚪 Join Room' : '✨ Create Room'}
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
                    ].map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRoomType(value)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all
                          ${roomType === value
                            ? 'border-accent-purple bg-accent-purple/10 text-accent-purple'
                            : 'border-border-dark text-text-secondary hover:border-border-light'}`}
                      >
                        <Icon className="w-4 h-4" /> {label}
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

      {/* ── Extension promo banner ── */}
      <section className="w-full border-t border-border-dark bg-bg-primary/60 backdrop-blur-sm py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center shrink-0">
              <Puzzle className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">Watch Netflix, Prime &amp; Hotstar together</p>
              <p className="text-xs text-text-muted mt-0.5">
                Install the free browser extension · each person uses their own subscription
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {['Netflix','Prime','Hotstar','JioCinema','Disney+','Zee5'].map((p) => (
              <span key={p} className="text-xs font-semibold px-2.5 py-1 rounded-full border border-border-dark text-text-muted">{p}</span>
            ))}
            <a
              href="https://github.com/amitdubey88/VibeSync/tree/main/extension"
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shrink-0"
            >
              <Puzzle className="w-3.5 h-3.5" /> Get Extension
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
