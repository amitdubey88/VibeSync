import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Developer — VibeSync',
  description: 'Meet the developer behind VibeSync.',
};

import { Footer } from '../../src/components/UI/Footer';

export default function DeveloperPage() {
  return (
    <div className="flex flex-col min-h-screen bg-obsidian-background text-obsidian-on-surface font-body">
      <main className="flex-grow pt-24 pb-16 px-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-obsidian-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-obsidian-tertiary/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10">
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-obsidian-primary hover:text-obsidian-tertiary transition-colors mb-8 text-sm font-semibold tracking-wider font-headline uppercase group">
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary font-headline uppercase mb-6 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] text-center">
            The Developer
          </h1>
        </div>

        <section className="glass-panel p-8 md:p-12 rounded-3xl border border-obsidian-outline-variant/30 shadow-[0_15px_50px_rgba(0,0,0,0.2)] text-center">
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-obsidian-primary/50 animate-pulse" style={{ animationDuration: '3s' }}></div>
            <div className="absolute inset-2 rounded-full border border-obsidian-tertiary/40"></div>
            <img 
              src="https://github.com/amitdubey88.png" 
              alt="Amit Dubey" 
              className="w-full h-full object-cover rounded-full shadow-[0_0_20px_rgba(168,85,247,0.4)] p-1 relative z-10"
            />
          </div>
          
          <h2 className="text-3xl font-bold text-white font-headline tracking-wide uppercase mb-2">
            Amit Dubey
          </h2>
          <p className="text-obsidian-primary font-headline text-sm tracking-widest uppercase font-semibold mb-8">
            Creator, Salesforce Developer and a Vibe Coding Enthusiast
          </p>
          
          <div className="text-obsidian-on-surface-variant leading-relaxed max-w-xl mx-auto space-y-4 mb-10 text-left md:text-center">
            <p>
              I built VibeSync to solve the classic long-distance movie night problem. Using modern WebRTC, Socket.io, and Next.js, my goal was to create a zero-latency, secure, and beautiful platform that actually feels like you're in the same room.
            </p>
            <p>
              Passionate about real-time systems, performant UI/UX, and building tools that connect people through shared experiences.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 border-t border-obsidian-outline-variant/20 pt-8">
            <a 
              href="https://github.com/amitdubey88" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-3 bg-obsidian-surface border border-obsidian-outline-variant/50 hover:border-obsidian-primary/60 rounded-xl text-white font-headline text-sm tracking-wide uppercase font-bold flex items-center justify-center gap-3 transition-all hover:bg-obsidian-primary/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] group"
            >
              <svg className="w-5 h-5 fill-current text-obsidian-on-surface-variant group-hover:text-white transition-colors" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.374 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.724-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.814 1.102.814 2.222v3.293c0 .319.192.694.801.576C20.565 21.796 24 17.298 24 12c0-6.626-5.373-12-12-12z" />
              </svg>
              View GitHub
            </a>
            
            <a 
              href="https://github.com/amitdubey88/VibeSync" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-obsidian-primary/20 to-obsidian-tertiary/10 border border-obsidian-primary/50 text-obsidian-primary rounded-xl font-headline text-sm tracking-wide uppercase font-bold flex items-center justify-center gap-2 transition-all hover:bg-obsidian-primary/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:-translate-y-1"
            >
              Star the Repo
            </a>
          </div>
        </section>
      </div>
      </main>
      <Footer />
    </div>
  );
}
