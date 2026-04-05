import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — VibeSync',
  description: 'Terms and conditions for using the VibeSync platform.',
};

import { Footer } from '../../src/components/UI/Footer';

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-obsidian-background text-obsidian-on-surface font-body">
      <main className="flex-grow pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-obsidian-primary hover:text-obsidian-tertiary transition-colors mb-8 text-sm font-semibold tracking-wider font-headline uppercase group">
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary font-headline uppercase mb-6 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">
            Terms of Service
          </h1>
          <p className="text-lg md:text-xl text-obsidian-on-surface-variant font-light leading-relaxed">
            Effective Date: April 2026
          </p>
        </div>

        <div className="space-y-12">
          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-obsidian-primary rounded-full"></span>
              1. Acceptance of Terms
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                By accessing or using VibeSync, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must abstain from using the platform.
              </p>
            </div>
          </section>

          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-obsidian-tertiary rounded-full"></span>
              2. User Content & Conduct
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                VibeSync provides tools that allow users to synchronize video playback from external sources (such as YouTube or local files). You are solely responsible for verifying that you have the appropriate rights and permissions for any content you synchronize or upload through the platform.
              </p>
              <p>
                You agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Stream, sync, or distribute copyrighted material without authorization.</li>
                <li>Use the voice or chat features to harass, abuse, or threaten others.</li>
                <li>Attempt to bypass or exploit the End-to-End Encryption architecture.</li>
              </ul>
              <p>
                Room Hosts assume responsibility for moderating their environments using the provided Host Controls (muting, locking, kicking). VibeSync retains the right to terminate access for users found violating these guidelines.
              </p>
            </div>
          </section>

          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-cyan-400 rounded-full"></span>
              3. Disclaimer of Warranties
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                VibeSync is provided "as is" and "as available". As a project constructed in an open-source spirit, we make no guarantees that the platform will always be safe, secure, or error-free, or that the services will function without disruptions or delays.
              </p>
            </div>
          </section>

          <section className="glass-panel p-8 rounded-2xl border border-obsidian-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="text-2xl font-bold text-white font-headline uppercase tracking-tight mb-4 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-red-400 rounded-full"></span>
              4. External Connections
            </h2>
            <div className="text-obsidian-on-surface-variant leading-relaxed space-y-4">
              <p>
                Our external link functionality interfaces directly with third-party sites. We do not affiliate with these entities. Your use of third-party platforms remains subject to their respective Terms of Service and subscription requirements.
              </p>
            </div>
          </section>

        </div>
      </div>
      </main>
      <Footer />
    </div>
  );
}
