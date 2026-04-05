import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — VibeSync',
  description: 'Learn how VibeSync protects your data with end-to-end encryption.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-obsidian-background text-obsidian-on-surface font-body pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-obsidian-primary hover:text-obsidian-tertiary transition-colors mb-8 text-sm font-semibold tracking-wider font-headline uppercase group">
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary font-headline uppercase mb-6 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">
            Privacy Policy
          </h1>
          <p className="text-lg md:text-xl text-obsidian-on-surface-variant font-light leading-relaxed">
            Effective Date: April 2026
          </p>
        </div>

        <div className="space-y-12">
          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-obsidian-primary rounded-full"></span>
              1. Information We Collect
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                <strong>Account Data:</strong> VibeSync can be used completely anonymously via our Guest mode. If you choose to join a room, we only require a temporary display name.
              </p>
              <p>
                <strong>Usage Data:</strong> We may collect generic, anonymized telemetry (e.g., room creation counts) to ensure our servers remain stable, but we do not track individual session analytics.
              </p>
            </div>
          </section>

          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-obsidian-tertiary rounded-full"></span>
              2. End-to-End Encryption (E2EE)
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                Your privacy is our core architectural focus. We utilize the Web Crypto API framework (AES-GCM) to ensure that the content inside your rooms remains private.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Chat & Assets:</strong> Your chat messages and shared URLs are encrypted on your device. Our servers only ever receive, store, and relay randomized ciphertext. We physically cannot read your messages.</li>
                <li><strong>Encryption Keys:</strong> Keys are heavily derived locally (PBKDF2 over 100,000 iterations) using your specific Room Code.</li>
              </ul>
            </div>
          </section>

          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-cyan-400 rounded-full"></span>
              3. WebRTC & Peer-to-Peer Data
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                When utilizing our Voice Chat or "Stream Instantly" P2P capabilities, your device connects directly with other users in the room via WebRTC.
              </p>
              <p>
                <strong>Please Note:</strong> Establishing a direct peer-to-peer connection inherently requires IP addresses to be exchanged between participants. This is standard internet protocol behavior. If you are uncomfortable exchanging IP data with strangers, we recommend utilizing VPNs or restricting room access only to trusted friends via passwords/lobbies.
              </p>
            </div>
          </section>

          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-red-400 rounded-full"></span>
              4. Data Retention & Deletion
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                Because VibeSync focuses on ephemeral, real-time sync states, we do not employ long-term data storage architectures. 
              </p>
              <p>
                <strong>Room Destruction:</strong> The moment a room is closed by the host or becomes completely empty, that room instance is purged from server memory. Any associated (and encrypted) persistent state for that session is permanently and immediately deleted from our temporal caches.
              </p>
            </div>
          </section>

          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
              5. Cookies
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                VibeSync uses only strictly necessary browser session storage tokens (like React context and HTML5 SessionStorage) to keep you connected to your active room if you refresh the page. We do not use persistent tracking cookies, nor do we sell data to third-party ad networks.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
