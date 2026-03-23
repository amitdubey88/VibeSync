import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRoom, getRoomInfo } from '../services/api';
import toast from 'react-hot-toast';
import { 
  PlayIcon, AddIcon, EastIcon, StarIcon, PublicIcon, LockIcon, 
  LanguageIcon, ShareIcon, SyncIcon, EncryptionIcon, ForumIcon
} from '../components/UI/SharpIcons';

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
  }, [user, username]);

  // Auto-rejoin last active room if user accidentally disconnected
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get('kicked')) {
      toast.error('You have been removed from the room by the host.', {
        id: 'kicked-toast',
        duration: 5000,
        icon: <span className="material-symbols-outlined text-red-500 text-xl">block</span>
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
  }, [navigate, location.state, location.search]);

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
      sessionStorage.setItem("vibesync_session", JSON.stringify({
        roomCode: room.code,
        username: username.trim(),
        joinedAt: Date.now()
      }));
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
      sessionStorage.setItem("vibesync_session", JSON.stringify({
        roomCode: room.code,
        username: username.trim(),
        joinedAt: Date.now()
      }));
      navigate(`/room/${room.code}`, { state: { password } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-background text-obsidian-on-surface font-body selection:bg-obsidian-primary/30 selection:text-obsidian-primary flex flex-col pt-16">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-obsidian-surface/40 backdrop-blur-2xl border-b border-obsidian-outline-variant/30 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/favicon-192.png" alt="VibeSync" className="w-9 h-9 object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]" />
            <span className="text-2xl font-bold tracking-tight text-obsidian-primary font-headline uppercase">VibeSync</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <span className="text-obsidian-primary font-semibold font-headline text-xs tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 bg-obsidian-primary rounded-full animate-pulse"></span>
              LIVE SYNC
            </span>
            <span className="text-obsidian-outline font-headline text-xs tracking-wide flex items-center gap-2">
              <EncryptionIcon size={14} className="text-obsidian-outline" />
              SECURE
            </span>
          </nav>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const accessHub = document.getElementById("access-hub");
                if (accessHub) accessHub.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-obsidian-primary/15 border border-obsidian-primary/40 text-obsidian-primary px-5 py-2.5 text-xs font-bold font-headline tracking-tight uppercase transition-all active:scale-95 hover:bg-obsidian-primary/25 hover:border-obsidian-primary/60"
            >
              ACCESS ROOM
            </button>
          </div>
        </div>
      </header>

      {/* ── Room Ended by Host Modal ── */}
      {location.state?.roomEnded && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-lg">
          <div className="glass-panel p-8 max-w-sm w-full border border-obsidian-outline-variant/50 text-center shadow-[0_0_40px_rgba(239,68,68,0.15)] rounded-xl">
            <div className="w-14 h-14 bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-6 rounded-lg">
              <span className="material-symbols-outlined text-red-400 text-2xl font-bold">close</span>
            </div>
            <h2 className="text-lg font-headline font-bold tracking-tight uppercase text-white mb-2">Session Ended</h2>
            <p className="text-obsidian-on-surface-variant text-sm mb-8 tracking-normal">{location.state.roomEnded}</p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true, state: {} })}
              className="w-full py-3 bg-obsidian-primary text-white font-headline font-bold tracking-tight uppercase hover:shadow-[0_8px_20px_rgba(168,85,247,0.3)] transition-all duration-300 rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      <main className="relative flex-1 overflow-hidden">
        {/* Hero Section */}
        <section className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 overflow-hidden">
          {/* Background Decorative Elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-20 left-1/3 -translate-x-1/2 w-96 h-96 bg-obsidian-primary/8 rounded-full blur-[130px]"></div>
            <div className="absolute bottom-0 right-10 w-[500px] h-[500px] bg-obsidian-tertiary/6 rounded-full blur-[140px]"></div>
            <div className="absolute top-1/2 -left-1/4 w-96 h-96 bg-obsidian-secondary/5 rounded-full blur-[120px]"></div>
          </div>

          <div className="max-w-4xl w-full text-center relative z-10">
            <h1 className="font-headline font-bold text-5xl md:text-7xl lg:text-8xl leading-tight tracking-tight uppercase mb-6">
              Watch Together
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-obsidian-primary via-obsidian-tertiary to-obsidian-secondary">
                Synchronized
              </span>
            </h1>
            <p className="text-obsidian-on-surface-variant text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light tracking-normal leading-relaxed">
              Experience seamless, synchronized streaming with friends. Real-time chat, reactions, and perfect playback alignment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => {
                  setTab('create');
                  document.getElementById("access-hub")?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-8 py-3.5 bg-obsidian-primary text-white font-headline font-bold tracking-tight uppercase shadow-[0_8px_25px_rgba(168,85,247,0.3)] transition-all hover:shadow-[0_12px_35px_rgba(168,85,247,0.4)] hover:-translate-y-0.5 active:scale-95"
              >
                Create Room
              </button>
              <button 
                onClick={() => {
                  setTab('join');
                  document.getElementById("access-hub")?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-8 py-3.5 bg-obsidian-surface border border-obsidian-primary/40 text-obsidian-primary font-headline font-bold tracking-tight uppercase hover:border-obsidian-primary/70 hover:bg-obsidian-primary/10 transition-all active:scale-95"
              >
                Join Room
              </button>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40 hover:opacity-70 transition-opacity">
            <span className="text-[11px] font-headline tracking-widest uppercase">Scroll</span>
            <svg className="w-5 h-8 text-obsidian-primary animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </section>

        {/* Join Room Form Section */}
        <section id="access-hub" className="py-24 px-6 relative z-20">
          <div className="max-w-xl mx-auto glass-panel p-8 md:p-12 relative overflow-hidden border border-obsidian-outline-variant/40">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-obsidian-primary/10 rounded-full blur-[60px] pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="font-headline text-3xl font-bold tracking-tight uppercase mb-2">Enter a Room</h2>
              <p className="text-obsidian-on-surface-variant text-sm mb-10 tracking-normal">Pick a username and join or create a watch party.</p>

              {/* Username Input (Always visible) */}
              <div className="relative mb-10 group/input">
                <input
                  type="text"
                  className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-3 px-0 text-obsidian-on-surface placeholder:text-obsidian-outline focus:ring-0 focus:border-obsidian-primary transition-all uppercase tracking-wide text-sm font-medium"
                  placeholder="Your Display Name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={30}
                  autoComplete="off"
                />
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary transition-all duration-500 group-focus-within/input:w-full"></div>
                {!username && (
                  <p className="absolute -bottom-5 left-0 text-[11px] uppercase tracking-wider text-red-400 opacity-70">Required to join</p>
                )}
              </div>

              {/* Tab Switcher */}
              <div className="flex gap-2 border-b border-obsidian-outline-variant/40 mb-8">
                <button 
                  onClick={() => setTab('join')} 
                  className={`flex-1 pb-4 font-headline uppercase tracking-wide text-xs font-semibold transition-all relative ${tab === 'join' ? 'text-obsidian-primary' : 'text-obsidian-outline-variant hover:text-obsidian-on-surface-variant'}`}
                >
                  Join
                  {tab === 'join' && <div className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-obsidian-primary via-obsidian-primary to-transparent rounded-t-full"></div>}
                </button>
                <button 
                  onClick={() => setTab('create')} 
                  className={`flex-1 pb-4 font-headline uppercase tracking-wide text-xs font-semibold transition-all relative ${tab === 'create' ? 'text-obsidian-primary' : 'text-obsidian-outline-variant hover:text-obsidian-on-surface-variant'}`}
                >
                  Create
                  {tab === 'create' && <div className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-obsidian-primary via-obsidian-primary to-transparent rounded-t-full"></div>}
                </button>
              </div>

              {/* Join Form */}
              {tab === 'join' && (
                <form onSubmit={handleJoin} className="space-y-6 animate-fade-in">
                  <div className="relative group/input">
                    <input
                      type="text"
                      className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-3 px-0 text-obsidian-on-surface placeholder:text-obsidian-outline focus:ring-0 focus:border-obsidian-primary transition-all uppercase tracking-wide text-sm font-medium"
                      placeholder="Room Code"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                      maxLength={6}
                      autoComplete="off"
                    />
                    <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary transition-all duration-500 group-focus-within/input:w-full"></div>
                  </div>
                  
                  <div className="relative group/input">
                    <input
                      type="password"
                      className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-3 px-0 text-obsidian-on-surface placeholder:text-obsidian-outline focus:ring-0 focus:border-obsidian-primary transition-all tracking-normal text-sm font-medium"
                      placeholder="Password (if needed)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary transition-all duration-500 group-focus-within/input:w-full"></div>
                  </div>
                  
                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-obsidian-primary text-white font-headline font-bold tracking-tight uppercase shadow-[0_8px_20px_rgba(168,85,247,0.2)] hover:shadow-[0_12px_30px_rgba(168,85,247,0.3)] transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading ? 'Joining...' : 'Join Room'}
                    {!loading && <EastIcon size={16} className="text-white" />}
                  </button>
                </form>
              )}

              {/* Create Form */}
              {tab === 'create' && (
                <form onSubmit={handleCreate} className="space-y-6 animate-fade-in">
                  <div className="relative group/input">
                    <input
                      type="text"
                      className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-3 px-0 text-obsidian-on-surface placeholder:text-obsidian-outline focus:ring-0 focus:border-obsidian-primary transition-all tracking-normal text-sm font-medium"
                      placeholder="Room Name"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      maxLength={60}
                    />
                    <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary transition-all duration-500 group-focus-within/input:w-full"></div>
                  </div>

                  <div className="flex gap-3">
                    {['public', 'private'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRoomType(type)}
                        className={`flex-1 py-3 border rounded-lg text-xs font-semibold tracking-wide uppercase transition-all flex items-center justify-center gap-2
                          ${roomType === type 
                            ? 'border-obsidian-primary text-obsidian-primary bg-obsidian-primary/12 shadow-[0_4px_15px_rgba(168,85,247,0.2)]' 
                            : 'border-obsidian-outline-variant text-obsidian-outline-variant hover:border-obsidian-primary/50 hover:text-obsidian-on-surface-variant hover:bg-obsidian-surface/50'}`}
                      >
                        <span className="w-4 h-4 flex items-center justify-center">
                          {type === 'public' ? <PublicIcon size={14} /> : <LockIcon size={14} />}
                        </span>
                        <span className="capitalize">{type}</span>
                      </button>
                    ))}
                  </div>

                  {roomType === 'private' && (
                    <div className="relative group/input animate-fade-in">
                      <input
                        type="password"
                        className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-3 px-0 text-obsidian-on-surface placeholder:text-obsidian-outline focus:ring-0 focus:border-obsidian-primary transition-all tracking-normal text-sm font-medium"
                        placeholder="Room Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary transition-all duration-500 group-focus-within/input:w-full"></div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-obsidian-outline-variant/30">
                    <label className="flex items-center gap-3 cursor-pointer group/toggle w-fit">
                      <div className="relative flex items-center justify-center w-5 h-5 border border-obsidian-outline-variant rounded transition-all group-hover/toggle:border-obsidian-primary group-hover/toggle:bg-obsidian-primary/10">
                        <input 
                          type="checkbox" 
                          checked={scheduleToggle} 
                          onChange={(e) => setScheduleToggle(e.target.checked)}
                          className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {scheduleToggle && (
                          <div className="w-2.5 h-2.5 bg-obsidian-primary rounded-sm"></div>
                        )}
                      </div>
                      <span className="font-headline text-xs tracking-wide uppercase text-obsidian-outline-variant group-hover/toggle:text-obsidian-on-surface transition-colors">
                        Schedule for later
                      </span>
                    </label>

                    {scheduleToggle && (
                      <div className="mt-4 flex flex-col gap-2 animate-fade-in">
                        <input
                          type="datetime-local"
                          className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-3 px-0 text-obsidian-on-surface placeholder:text-obsidian-outline focus:ring-0 focus:border-obsidian-primary transition-all text-sm font-medium"
                          style={{ colorScheme: 'dark' }}
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        <p className="text-[11px] text-obsidian-outline-variant tracking-normal mt-1">
                          Countdown appears until room starts
                        </p>
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-obsidian-primary text-white font-headline font-bold tracking-tight uppercase shadow-[0_8px_20px_rgba(168,85,247,0.2)] hover:shadow-[0_12px_30px_rgba(168,85,247,0.3)] transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? 'Creating...' : 'Create Room'}
                    {!loading && <AddIcon size={16} className="text-white" />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-32 px-6 max-w-7xl mx-auto border-t border-obsidian-outline-variant/30">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div className="max-w-xl">
              <h2 className="font-headline text-4xl md:text-5xl font-bold tracking-tight uppercase mb-6">Features</h2>
              <p className="text-obsidian-on-surface-variant text-base font-light leading-relaxed">Everything you need for a synchronized watch party. Real-time playback, instant chat, reactions, and more.</p>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-5xl font-headline font-bold text-obsidian-outline-variant/20 tracking-tight uppercase">Beta</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="glass-panel p-6 flex flex-col group hover:border-obsidian-primary/50 transition-all duration-300 relative border border-obsidian-outline-variant/40 rounded-xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-obsidian-primary/5 rounded-full blur-[60px] group-hover:bg-obsidian-primary/10 transition-all duration-500"></div>
              <div className="mb-8 flex justify-between items-start relative z-10">
                <div className="w-12 h-12 bg-obsidian-primary/15 flex items-center justify-center rounded-lg border border-obsidian-primary/30 group-hover:border-obsidian-primary/50 transition-all">
                   <SyncIcon size={24} className="text-obsidian-primary" />
                </div>
                <span className="text-obsidian-outline-variant/40 font-headline text-xs font-bold">01</span>
              </div>
              <h3 className="font-headline text-lg font-bold tracking-tight uppercase mb-3 group-hover:text-obsidian-primary transition-colors relative z-10">Real-Time Sync</h3>
              <p className="text-obsidian-on-surface-variant leading-relaxed text-sm mb-6 font-light relative z-10">Perfect playback synchronization across all viewers with sub-10ms latency.</p>
              <div className="mt-auto pt-3 border-t border-obsidian-outline-variant/20 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                <span className="text-[10px] font-headline tracking-wide uppercase text-obsidian-primary">Protocol Enabled</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel p-6 flex flex-col group hover:border-red-500/50 transition-all duration-300 relative border border-obsidian-outline-variant/40 rounded-xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-500/5 rounded-full blur-[60px] group-hover:bg-red-500/10 transition-all duration-500"></div>
              <div className="mb-8 flex justify-between items-start relative z-10">
                <div className="w-12 h-12 bg-red-500/15 flex items-center justify-center rounded-lg border border-red-500/30 group-hover:border-red-500/50 transition-all">
                   <EncryptionIcon size={24} className="text-red-500" />
                </div>
                <span className="text-obsidian-outline-variant/40 font-headline text-xs font-bold">02</span>
              </div>
              <h3 className="font-headline text-lg font-bold tracking-tight uppercase mb-3 group-hover:text-red-500 transition-colors relative z-10">Total Privacy</h3>
              <p className="text-obsidian-on-surface-variant leading-relaxed text-sm mb-6 font-light relative z-10">End-to-end encryption. Your data stays private and secure.</p>
              <div className="mt-auto pt-3 border-t border-obsidian-outline-variant/20 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                <span className="text-[10px] font-headline tracking-wide uppercase text-red-500">Secured</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel p-6 flex flex-col group hover:border-cyan-400/50 transition-all duration-300 relative border border-obsidian-outline-variant/40 rounded-xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-400/5 rounded-full blur-[60px] group-hover:bg-cyan-400/10 transition-all duration-500"></div>
              <div className="mb-8 flex justify-between items-start relative z-10">
                <div className="w-12 h-12 bg-cyan-400/15 flex items-center justify-center rounded-lg border border-cyan-400/30 group-hover:border-cyan-400/50 transition-all">
                   <ForumIcon size={24} className="text-cyan-400" />
                </div>
                <span className="text-obsidian-outline-variant/40 font-headline text-xs font-bold">03</span>
              </div>
              <h3 className="font-headline text-lg font-bold tracking-tight uppercase mb-3 group-hover:text-cyan-400 transition-colors relative z-10">Live Chat</h3>
              <p className="text-obsidian-on-surface-variant leading-relaxed text-sm mb-6 font-light relative z-10">Real-time reactions and immersive messaging with your community.</p>
              <div className="mt-auto pt-3 border-t border-obsidian-outline-variant/20 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                <span className="text-[10px] font-headline tracking-wide uppercase text-cyan-400">Connected</span>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section className="py-32 bg-obsidian-surface-low/30 overflow-hidden relative border-y border-obsidian-outline-variant/30">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="aspect-video bg-obsidian-surface border border-obsidian-outline-variant/40 shadow-2xl overflow-hidden group rounded-xl">
                <img 
                  alt="VibeSync Interface" 
                  className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-1000" 
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-bg via-transparent to-transparent"></div>
                <div className="absolute bottom-8 left-8 flex items-center gap-4">
                  <div className="w-12 h-12 bg-obsidian-primary/20 flex items-center justify-center backdrop-blur-md border border-obsidian-primary/40 rounded-lg">
                    <PlayIcon size={24} className="text-obsidian-primary" />
                  </div>
                  <div className="font-headline text-xs font-bold tracking-wide uppercase text-white shadow-sm">Watch Preview</div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-6">
              <span className="text-obsidian-primary font-headline font-bold text-xs tracking-wider uppercase">How it works</span>
              <h2 className="font-headline text-4xl md:text-5xl font-bold tracking-tight uppercase leading-tight">Synchronized streaming made simple.</h2>
              <p className="text-obsidian-on-surface-variant text-base font-light leading-relaxed">Create or join a room, invite friends, and start watching together. Our platform handles all the technical complexity so you can focus on enjoying the experience.</p>
              <div className="flex flex-wrap gap-3 mt-2">
                <span className="px-3 py-2 bg-obsidian-primary/10 text-[11px] font-headline font-semibold tracking-normal uppercase border border-obsidian-primary/30 text-obsidian-primary rounded-lg">HD Video</span>
                <span className="px-3 py-2 bg-obsidian-tertiary/10 text-[11px] font-headline font-semibold tracking-normal uppercase border border-obsidian-tertiary/30 text-obsidian-tertiary rounded-lg">Low Latency</span>
                <span className="px-3 py-2 bg-red-500/10 text-[11px] font-headline font-semibold tracking-normal uppercase border border-red-500/30 text-red-400 rounded-lg">Encrypted</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-obsidian-bg w-full border-t border-obsidian-outline-variant/30 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-10 gap-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-base font-bold text-obsidian-on-surface font-headline tracking-tight uppercase">VibeSync</span>
            <p className="font-body text-xs tracking-normal text-obsidian-on-surface-variant">Watch parties, synchronized</p>
          </div>
          <div className="flex items-center gap-8 border-r border-l px-8 border-obsidian-outline-variant/30 hidden md:flex">
            <a className="font-headline text-xs tracking-normal text-obsidian-on-surface-variant hover:text-obsidian-primary transition-colors uppercase" href="#">Privacy</a>
            <a className="font-headline text-xs tracking-normal text-obsidian-on-surface-variant hover:text-obsidian-primary transition-colors uppercase" href="#">Terms</a>
            <a className="font-headline text-xs tracking-normal text-obsidian-on-surface-variant hover:text-obsidian-primary transition-colors uppercase" href="#">Contact</a>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 border border-white/5 flex items-center justify-center hover:border-obsidian-primary/50 transition-colors group cursor-pointer bg-black/20">
              <LanguageIcon size={20} className="text-neutral-500 group-hover:text-obsidian-primary transition-colors" />
            </div>
            <div className="w-10 h-10 border border-white/5 flex items-center justify-center hover:border-obsidian-primary/50 transition-colors group cursor-pointer bg-black/20">
              <ShareIcon size={20} className="text-neutral-500 group-hover:text-obsidian-primary transition-colors" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
