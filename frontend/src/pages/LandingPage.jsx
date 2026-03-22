import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRoom, getRoomInfo } from '../services/api';
import toast from 'react-hot-toast';

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
      <header className="fixed top-0 left-0 w-full z-50 bg-neutral-950/70 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/favicon-192.png" alt="VibeSync" className="w-9 h-9 object-contain drop-shadow-[0_0_15px_rgba(189,157,255,0.4)] rounded-xl" />
            <span className="text-2xl font-bold tracking-tighter text-obsidian-primary font-headline uppercase">VIBESYNC</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <span className="text-obsidian-primary font-bold font-headline text-sm tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-obsidian-primary animate-pulse blur-[1px]"></span>
              REAL-TIME SYNC
            </span>
            <span className="text-obsidian-outline font-headline text-sm tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">enhanced_encryption</span>
              E2EE SECURE
            </span>
          </nav>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const accessHub = document.getElementById("access-hub");
                if (accessHub) accessHub.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-obsidian-primary/10 border border-obsidian-primary/20 text-obsidian-primary px-5 py-2 text-xs font-bold font-headline tracking-tighter uppercase transition-all active:scale-95 hover:bg-obsidian-primary/20"
            >
              JOIN ROOM
            </button>
          </div>
        </div>
      </header>

      {/* ── Room Ended by Host Modal ── */}
      {location.state?.roomEnded && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-panel p-10 max-w-sm w-full border border-obsidian-outline-variant text-center shadow-[0_0_50px_rgba(220,38,38,0.2)]">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-red-500 text-3xl">dangerous</span>
            </div>
            <h2 className="text-xl font-headline font-bold tracking-widest uppercase text-white mb-2">SESSION TERMINATED</h2>
            <p className="text-obsidian-on-surface-variant text-sm mb-8 tracking-wide">{location.state.roomEnded}</p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true, state: {} })}
              className="w-full py-4 bg-obsidian-surface-high border border-obsidian-outline-variant text-white font-headline font-bold tracking-widest uppercase hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>
      )}

      <main className="relative flex-1 overflow-hidden">
        {/* Hero Section */}
        <section className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6">
          {/* Background Decorative Element */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-obsidian-primary-dim/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-obsidian-secondary-container/10 rounded-full blur-[120px]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-obsidian-primary/5 rounded-full blur-[150px]"></div>
          </div>

          <div className="max-w-5xl w-full text-center relative z-10 animate-slide-up">
            <h1 className="font-headline font-bold text-5xl md:text-8xl lg:text-9xl leading-[0.9] tracking-tighter uppercase mb-8" style={{ textShadow: '0 0 30px rgba(189,157,255,0.4)' }}>
              EXPERIENCE THE FUTURE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-obsidian-primary via-obsidian-primary-container to-obsidian-secondary">
                OF STREAMING
              </span>
            </h1>
            <p className="text-obsidian-on-surface-variant text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light tracking-wide leading-relaxed">
              Synchronized high-fidelity playback meets atmospheric interaction. Redefining how the world watches together.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <button 
                onClick={() => {
                  setTab('create');
                  document.getElementById("access-hub")?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-obsidian-primary to-obsidian-primary-dim text-obsidian-on-primary-fixed font-headline font-bold tracking-tighter uppercase shadow-[0_0_20px_rgba(138,76,252,0.3)] transition-transform hover:-translate-y-1 active:scale-95"
              >
                Create Room
              </button>
              <button 
                onClick={() => {
                  setTab('join');
                  document.getElementById("access-hub")?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-10 py-5 bg-transparent border border-obsidian-primary/40 text-obsidian-primary font-headline font-bold tracking-tighter uppercase hover:bg-obsidian-primary/5 transition-all active:scale-95"
              >
                Join Room
              </button>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 animate-pulse">
            <span className="text-[10px] font-headline tracking-[0.3em] uppercase">SCROLL</span>
            <div className="w-[1px] h-12 bg-gradient-to-b from-obsidian-primary to-transparent"></div>
          </div>
        </section>

        {/* Join Room Form Section */}
        <section id="access-hub" className="py-24 px-6 relative z-20">
          <div className="max-w-xl mx-auto glass-panel p-8 md:p-14 rounded-lg relative overflow-hidden group border border-obsidian-outline-variant/30">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-obsidian-primary to-transparent opacity-50"></div>
            <div className="relative z-10">
              <h2 className="font-headline text-3xl font-bold tracking-tighter uppercase mb-2">ACCESS HUB</h2>
              <p className="text-obsidian-on-surface-variant text-sm mb-10 tracking-wide uppercase">Authenticate and Sync Vibes.</p>

              {/* Username Input (Always visible) */}
              <div className="relative mb-10 group/input">
                <input
                  type="text"
                  className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-4 px-0 text-white font-headline placeholder:text-neutral-600 focus:ring-0 focus:border-obsidian-primary transition-all uppercase tracking-widest text-base"
                  placeholder="YOUR ALIAS (REQUIRED)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={30}
                  autoComplete="off"
                />
                <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-obsidian-primary transition-all duration-500 group-focus-within/input:w-full"></div>
                {!username && (
                  <p className="absolute -bottom-5 left-0 text-[10px] uppercase tracking-wider text-red-400 opacity-80">Required to connect to neural net</p>
                )}
              </div>

              {/* Tab Switcher */}
              <div className="flex border-b border-white/5 mb-8">
                <button 
                  onClick={() => setTab('join')} 
                  className={`flex-1 pb-4 font-headline uppercase tracking-widest text-xs tracking-[0.2em] font-bold transition-colors relative ${tab === 'join' ? 'text-obsidian-primary' : 'text-obsidian-outline hover:text-white'}`}
                >
                  JOIN ROOM
                  {tab === 'join' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-obsidian-primary shadow-[0_0_10px_rgba(189,157,255,0.5)]"></div>}
                </button>
                <button 
                  onClick={() => setTab('create')} 
                  className={`flex-1 pb-4 font-headline uppercase tracking-widest text-xs tracking-[0.2em] font-bold transition-colors relative ${tab === 'create' ? 'text-obsidian-primary' : 'text-obsidian-outline hover:text-white'}`}
                >
                  CREATE ROOM
                  {tab === 'create' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-obsidian-primary shadow-[0_0_10px_rgba(189,157,255,0.5)]"></div>}
                </button>
              </div>

              {/* Join Form */}
              {tab === 'join' && (
                <form onSubmit={handleJoin} className="space-y-8 animate-fade-in">
                  <div className="relative group/input">
                    <input
                      type="text"
                      className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-4 px-0 text-white font-headline placeholder:text-neutral-600 focus:ring-0 focus:border-obsidian-primary transition-all uppercase tracking-widest text-lg"
                      placeholder="ROOM CODE (E.G. ABC123)"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                      maxLength={6}
                      autoComplete="off"
                    />
                    <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-obsidian-primary transition-all duration-500 group-focus-within/input:w-full"></div>
                  </div>
                  
                  <div className="relative group/input">
                    <input
                      type="password"
                      className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-4 px-0 text-white font-headline placeholder:text-neutral-600 focus:ring-0 focus:border-obsidian-primary transition-all uppercase tracking-widest text-base"
                      placeholder="PASSWORD (IF PRIVATE)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-obsidian-primary transition-all duration-500 group-focus-within/input:w-full"></div>
                  </div>
                  
                  <button type="submit" disabled={loading} className="w-full py-5 bg-obsidian-surface-high border border-obsidian-outline-variant text-white font-headline font-bold tracking-widest uppercase hover:border-obsidian-primary/50 hover:bg-obsidian-surface-highest transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? 'SYNCING...' : 'ENTER DIMENSION'}
                    {!loading && <span className="material-symbols-outlined text-obsidian-primary text-xl">east</span>}
                  </button>
                </form>
              )}

              {/* Create Form */}
              {tab === 'create' && (
                <form onSubmit={handleCreate} className="space-y-8 animate-fade-in">
                  <div className="relative group/input">
                    <input
                      type="text"
                      className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-4 px-0 text-white font-headline placeholder:text-neutral-600 focus:ring-0 focus:border-obsidian-primary transition-all uppercase tracking-widest text-base"
                      placeholder="ROOM DESIGNATION (NAME)"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      maxLength={60}
                    />
                    <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-obsidian-primary transition-all duration-500 group-focus-within/input:w-full"></div>
                  </div>

                  <div className="flex gap-4">
                    {['public', 'private'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRoomType(type)}
                        className={`flex-1 py-4 border text-xs font-headline tracking-widest uppercase transition-all flex items-center justify-center gap-2
                          ${roomType === type 
                            ? 'border-obsidian-primary text-obsidian-primary bg-obsidian-primary/10 shadow-[inset_0_0_15px_rgba(189,157,255,0.1)]' 
                            : 'border-obsidian-outline-variant text-obsidian-outline hover:border-white/30 hover:text-white bg-obsidian-surface-container-high'}`}
                      >
                        <span className="material-symbols-outlined text-base">{type === 'public' ? 'public' : 'lock'}</span>
                        {type}
                      </button>
                    ))}
                  </div>

                  {roomType === 'private' && (
                    <div className="relative group/input animate-fade-in">
                      <input
                        type="password"
                        className="w-full bg-transparent border-0 border-b border-obsidian-outline-variant py-4 px-0 text-white font-headline placeholder:text-neutral-600 focus:ring-0 focus:border-obsidian-primary transition-all uppercase tracking-widest text-base"
                        placeholder="SET SECURE CIPHER (PASSWORD)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-obsidian-primary transition-all duration-500 group-focus-within/input:w-full"></div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/5">
                    <label className="flex items-center gap-3 cursor-pointer group/toggle w-fit">
                      <div className="relative flex items-center justify-center w-5 h-5 rounded border border-obsidian-outline transition-colors group-hover/toggle:border-obsidian-primary">
                        <input 
                          type="checkbox" 
                          checked={scheduleToggle} 
                          onChange={(e) => setScheduleToggle(e.target.checked)}
                          className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {scheduleToggle && (
                          <div className="w-2.5 h-2.5 bg-obsidian-primary rounded-sm shadow-[0_0_8px_rgba(189,157,255,0.8)]"></div>
                        )}
                      </div>
                      <span className="font-headline text-xs tracking-widest uppercase text-obsidian-outline group-hover/toggle:text-white transition-colors">
                        SCHEDULE FOR LATER
                      </span>
                    </label>

                    {scheduleToggle && (
                      <div className="mt-6 flex flex-col gap-2 animate-fade-in">
                        <input
                          type="datetime-local"
                          className="w-full bg-obsidian-surface-container-high border-0 border-b border-obsidian-outline-variant py-3 px-4 text-white font-headline placeholder:text-neutral-600 focus:ring-0 focus:border-obsidian-primary transition-all text-sm color-scheme-dark"
                          style={{ colorScheme: 'dark' }}
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        <p className="text-[10px] text-obsidian-outline tracking-wider font-headline uppercase mt-1">
                          A countdown will be shown to users until this time.
                        </p>
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-5 bg-gradient-to-r from-obsidian-primary to-obsidian-primary-dim text-obsidian-on-primary-fixed shadow-[0_0_20px_rgba(138,76,252,0.2)] font-headline font-bold tracking-widest uppercase hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(138,76,252,0.4)] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
                    {loading ? 'INITIALIZING...' : 'INITIALIZE ROOM'}
                    {!loading && <span className="material-symbols-outlined text-obsidian-on-primary-fixed text-xl">add</span>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-32 px-6 max-w-7xl mx-auto border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div className="max-w-xl">
              <h2 className="font-headline text-4xl md:text-6xl font-bold tracking-tighter uppercase mb-6">CORE ARCHITECTURE</h2>
              <p className="text-obsidian-on-surface-variant text-lg font-light leading-relaxed">Engineered for the elite. A suite of tools designed to remove the friction between you and the experience.</p>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-6xl font-headline font-bold text-obsidian-outline-variant/30 tracking-tighter uppercase">SYSTEM v2.0</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="glass-panel p-8 rounded-lg flex flex-col group hover:bg-obsidian-surface-high transition-colors duration-500 relative border border-white/5">
              <div className="mb-12 flex justify-between items-start">
                <div className="w-14 h-14 bg-obsidian-primary/10 flex items-center justify-center rounded-full border border-obsidian-primary/20">
                   <span className="material-symbols-outlined text-obsidian-primary text-3xl">sync</span>
                </div>
                <span className="text-neutral-700 font-headline font-bold">01</span>
              </div>
              <h3 className="font-headline text-2xl font-bold tracking-tighter uppercase mb-4 group-hover:text-obsidian-primary transition-colors">REAL-TIME SYNC</h3>
              <p className="text-obsidian-on-surface-variant leading-relaxed text-sm mb-8 font-light">Proprietary clock-synchronization ensuring sub-10ms latency across global nodes. No frame left behind.</p>
              <div className="mt-auto pt-4 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-headline tracking-widest uppercase text-obsidian-primary">ADVANCED PROTOCOL ENABLED</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel p-8 rounded-lg flex flex-col group hover:bg-obsidian-surface-high transition-colors duration-500 relative border border-white/5">
              <div className="mb-12 flex justify-between items-start">
                <div className="w-14 h-14 bg-red-500/10 flex items-center justify-center rounded-full border border-red-500/20">
                   <span className="material-symbols-outlined text-red-500 text-3xl">enhanced_encryption</span>
                </div>
                <span className="text-neutral-700 font-headline font-bold">02</span>
              </div>
              <h3 className="font-headline text-2xl font-bold tracking-tighter uppercase mb-4 group-hover:text-red-500 transition-colors">TOTAL PRIVACY</h3>
              <p className="text-obsidian-on-surface-variant leading-relaxed text-sm mb-8 font-light">End-to-End Encrypted sessions. Your data, your chat, and your voice remain exclusively in your control.</p>
              <div className="mt-auto pt-4 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-headline tracking-widest uppercase text-red-500">CIPHER KEY SECURED</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel p-8 rounded-lg flex flex-col group hover:bg-obsidian-surface-high transition-colors duration-500 relative border border-white/5">
              <div className="mb-12 flex justify-between items-start">
                <div className="w-14 h-14 bg-cyan-500/10 flex items-center justify-center rounded-full border border-cyan-500/20">
                   <span className="material-symbols-outlined text-cyan-500 text-3xl">forum</span>
                </div>
                <span className="text-neutral-700 font-headline font-bold">03</span>
              </div>
              <h3 className="font-headline text-2xl font-bold tracking-tighter uppercase mb-4 group-hover:text-cyan-500 transition-colors">IMMERSIVE CHAT</h3>
              <p className="text-obsidian-on-surface-variant leading-relaxed text-sm mb-8 font-light">Threaded reactions and spatial audio cues. Connect with your community without breaking immersion.</p>
              <div className="mt-auto pt-4 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-headline tracking-widest uppercase text-cyan-500">NEURAL COMMUNICATION READY</span>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Content Section */}
        <section className="py-32 bg-obsidian-surface-low overflow-hidden relative border-y border-white/5">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="aspect-video bg-obsidian-surface rounded-lg border border-white/5 shadow-2xl overflow-hidden group">
                <img 
                  alt="Cinematic Interface" 
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000" 
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-background via-transparent to-transparent"></div>
                <div className="absolute bottom-8 left-8 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-obsidian-primary/20 flex items-center justify-center backdrop-blur-md border border-obsidian-primary/30">
                    <span className="material-symbols-outlined text-obsidian-primary">play_arrow</span>
                  </div>
                  <div className="font-headline text-sm font-bold tracking-widest uppercase text-white shadow-sm">LIVE PREVIEW</div>
                </div>
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 border-r border-t border-obsidian-primary/20 hidden md:block"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 border-l border-b border-obsidian-primary/20 hidden md:block"></div>
            </div>
            
            <div className="flex flex-col gap-8">
              <span className="text-obsidian-primary font-headline font-bold text-sm tracking-[0.5em] uppercase">ATMOSPHERICS</span>
              <h2 className="font-headline text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.95]">THE VIEWPORT IS YOUR CANVAS.</h2>
              <p className="text-obsidian-on-surface-variant text-lg font-light leading-relaxed">We don't just stream video. We curate atmosphere. Our "Glass" interface adapts to the colors of your content, bleeding the emotional tone of every frame into your physical space.</p>
              <div className="flex flex-wrap gap-4 mt-4">
                <span className="px-4 py-2 bg-obsidian-surface-bright/10 text-[10px] font-headline font-bold tracking-widest uppercase rounded-full border border-white/5 text-obsidian-outline">DYNAMIC BLUR</span>
                <span className="px-4 py-2 bg-obsidian-surface-bright/10 text-[10px] font-headline font-bold tracking-widest uppercase rounded-full border border-white/5 text-obsidian-outline">ADAPTIVE GAIN</span>
                <span className="px-4 py-2 bg-obsidian-surface-bright/10 text-[10px] font-headline font-bold tracking-widest uppercase rounded-full border border-white/5 text-obsidian-outline">CINEMATIC FX</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-neutral-950 w-full border-t border-white/5 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-12 gap-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-lg font-bold text-neutral-200 font-headline tracking-tighter uppercase">VIBESYNC</span>
            <p className="font-body text-xs tracking-widest text-neutral-600 uppercase">A labor of love, crafted by Amit Dubey</p>
          </div>
          <div className="flex items-center gap-10 border-r border-l px-8 border-white/5 hidden md:flex">
            <a className="font-headline text-xs tracking-widest text-neutral-500 hover:text-white transition-colors uppercase" href="#">Privacy</a>
            <a className="font-headline text-xs tracking-widest text-neutral-500 hover:text-white transition-colors uppercase" href="#">Terms</a>
            <a className="font-headline text-xs tracking-widest text-neutral-500 hover:text-white transition-colors uppercase" href="#">Support</a>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 border border-white/5 flex items-center justify-center rounded-sm hover:border-obsidian-primary/50 transition-colors group cursor-pointer bg-black/20">
              <span className="material-symbols-outlined text-neutral-500 group-hover:text-obsidian-primary transition-colors text-xl">language</span>
            </div>
            <div className="w-10 h-10 border border-white/5 flex items-center justify-center rounded-sm hover:border-obsidian-primary/50 transition-colors group cursor-pointer bg-black/20">
              <span className="material-symbols-outlined text-neutral-500 group-hover:text-obsidian-primary transition-colors text-xl">share</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
