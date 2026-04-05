import Link from 'next/link';

export const metadata = {
  title: 'About VibeSync — The Ultimate Watch Party Platform',
  description: 'Learn how VibeSync solves the hassle of long-distance movie nights. Instantly sync video, video chat, and text with friends anywhere in the world.',
};

export default function About() {
  return (
    <div className="min-h-screen bg-obsidian-background text-obsidian-on-surface font-body pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-obsidian-primary hover:text-obsidian-tertiary transition-colors mb-8 text-sm font-semibold tracking-wider font-headline uppercase group">
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary font-headline uppercase mb-6 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">
            About VibeSync
          </h1>
          <p className="text-lg md:text-xl text-obsidian-on-surface-variant font-light leading-relaxed">
            The easiest way to host a watch party with your friends, no matter where they are. 
            No signups, no plugins, just a single link.
          </p>
        </div>

        <div className="space-y-12">
          {/* Section: What problem it solves */}
          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-obsidian-primary rounded-full"></span>
              What Problem Does VibeSync Solve?
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                Watching movies with long-distance friends over standard video calls usually results in laggy screen sharing, terrible framerates, and compressed audio. Not to mention the headache of "press play on 3... 2... 1..." countdowns to keep everyone in sync.
              </p>
              <p>
                VibeSync solves this by playing high-quality video locally on everyone's device while precisely synchronizing the playback state (play, pause, seek) over high-speed WebSockets. It acts as the ultimate digital living room—combining zero-latency synchronization with robust privacy and real-time voice chat.
              </p>
            </div>
          </section>

          {/* Section: Key Features */}
          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-obsidian-tertiary rounded-full"></span>
              Key Features
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {[
                { title: 'Any Content Anywhere', desc: 'Sync local video uploads, direct web URLs, YouTube, or use our extension for Netflix, Amazon Prime, Disney+, and more.' },
                { title: 'End-to-End Encrypted', desc: 'Zero-knowledge chat and assets. Uses Web Crypto API (AES-GCM) where your keys never leave your browser.' },
                { title: 'WebRTC P2P Voice Chat', desc: 'High-quality, full-mesh audio channels. Share dual-audio where you hear both the synced video and host commentary.' },
                { title: 'Room & Guest Moderation', desc: 'Full host controls. Lock your room, require permission to join, or mute unruly participants. Join anonymously without an account.' }
              ].map((item, i) => (
                <li key={i} className="bg-obsidian-surface/30 p-5 rounded-xl border border-obsidian-outline-variant/20 hover:border-obsidian-primary/40 transition-colors">
                  <h3 className="font-headline font-bold text-white uppercase tracking-wide text-sm mb-2">{item.title}</h3>
                  <p className="text-obsidian-on-surface-variant text-sm">{item.desc}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Section: How it works */}
          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-6 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-white rounded-full"></span>
              How It Works
            </h2>
            <div className="relative border-l border-obsidian-outline-variant/30 ml-3 md:ml-4 space-y-8 pb-4">
              {[
                { step: '01', title: 'Create a Secure Room', desc: 'Launch a private or public session as the Host. Everything is instantly protected by your room code.' },
                { step: '02', title: 'Load Your Media', desc: 'Select a local MP4, drop a YouTube link, initiate a zero-upload P2P WebRTC stream, or connect the Chrome Extension.' },
                { step: '03', title: 'Invite Your Friends', desc: 'Share the unique invite link. Guests join securely without installing heavy desktop apps or signing up for accounts.' },
                { step: '04', title: 'Watch & Vibe', desc: 'Whenever the host hits play, pauses, or seeks, everyone syncs instantly. Use the E2EE chat or WebRTC voice to react in real-time!' }
              ].map((item, i) => (
                <div key={i} className="relative pl-8 md:pl-10">
                  <div className="absolute -left-4 top-0.5 w-8 h-8 rounded-full bg-obsidian-surface border border-obsidian-outline-variant flex items-center justify-center text-xs font-headline font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold text-white font-headline tracking-wide mb-2">{item.title}</h3>
                  <p className="text-obsidian-on-surface-variant leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="text-center pt-8">
            <Link 
              href="/"
              className="inline-block bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary text-white px-8 py-4 rounded-lg font-bold font-headline tracking-widest uppercase text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:scale-105 transition-all duration-300"
            >
              Start Watching Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
