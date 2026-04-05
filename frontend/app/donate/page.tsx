import Link from 'next/link';
import { Heart, ShieldCheck, Zap, Globe, Share2 } from 'lucide-react';
import { Footer } from '../../src/components/UI/Footer';

export const metadata = {
  title: 'Support VibeSync — Donate',
  description: 'Help keep VibeSync live and support its development.',
};

export default function DonatePage() {
  return (
    <div className="flex flex-col min-h-screen bg-obsidian-background text-obsidian-on-surface font-body">
      <main className="flex-grow pt-24 pb-20 px-6 relative overflow-hidden">
        {/* Cinematic Backdrop Elements */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-obsidian-primary/5 rounded-full blur-[180px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-obsidian-tertiary/5 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="mb-16 text-center">
            <Link href="/" className="inline-flex items-center text-obsidian-primary hover:text-obsidian-tertiary transition-colors mb-10 text-sm font-semibold tracking-wider font-headline uppercase group">
              <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
              Back to Home
            </Link>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-obsidian-primary via-obsidian-tertiary to-obsidian-secondary font-headline uppercase mb-8 drop-shadow-[0_0_20px_rgba(168,85,247,0.3)]">
              Support VibeSync
            </h1>
            <p className="max-w-2xl mx-auto text-obsidian-on-surface-variant text-lg md:text-xl leading-relaxed font-light">
              Your support helps us keep the servers running, scale resources for thousands of users, and continue building the ultimate synchronized viewing experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Donation QR Section */}
            <div className="order-2 md:order-1">
              <div className="glass-panel p-8 md:p-12 rounded-[2.5rem] border border-obsidian-outline-variant/30 shadow-[0_30px_70px_rgba(0,0,0,0.5)] flex flex-col items-center text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-obsidian-primary/0 to-obsidian-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <h3 className="font-headline text-2xl font-bold text-white uppercase tracking-tight mb-8 relative z-10">
                  Universal Donation QR
                </h3>

                <div className="relative z-10 p-4 bg-white/5 border border-white/10 rounded-2xl mb-8 group-hover:scale-[1.02] transition-transform duration-500 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
                  <img 
                    src="/assets/donate_qr.png" 
                    alt="Universal Donation QR Code" 
                    className="w-64 h-64 md:w-72 md:h-72 object-contain rounded-lg"
                  />
                  <div className="absolute inset-x-0 -bottom-2 flex justify-center">
                    <div className="px-4 py-1 bg-obsidian-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg h-fit">
                      Scan to Support
                    </div>
                  </div>
                </div>

                <p className="text-obsidian-on-surface-variant text-sm max-w-xs relative z-10 leading-relaxed font-light">
                  Scan this universal QR code with any payment app to contribute directly to the VibeSync development fund.
                </p>
              </div>
            </div>

            {/* Why Your Support Matters */}
            <div className="order-1 md:order-2 flex flex-col gap-8">
              <div className="flex gap-6 items-start">
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-obsidian-primary/10 border border-obsidian-primary/20 flex items-center justify-center text-obsidian-primary shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                  <Zap size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white font-headline uppercase tracking-tight mb-2">High Performance</h4>
                  <p className="text-obsidian-on-surface-variant text-sm leading-relaxed font-light">
                    Contributions fund high-bandwidth servers and low-latency synchronization relays for perfect 4K watch parties.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white font-headline uppercase tracking-tight mb-2">Privacy & Security</h4>
                  <p className="text-obsidian-on-surface-variant text-sm leading-relaxed font-light">
                    Help us maintain Zero-Knowledge E2E encryption and secure infrastructure that respects your data privacy.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-obsidian-tertiary/10 border border-obsidian-tertiary/20 flex items-center justify-center text-obsidian-tertiary shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                  <Globe size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white font-headline uppercase tracking-tight mb-2">Universal Access</h4>
                  <p className="text-obsidian-on-surface-variant text-sm leading-relaxed font-light">
                    Your support ensures VibeSync remains a free, high-quality tool for everyone around the world to stay connected.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-8 rounded-3xl bg-gradient-to-br from-obsidian-primary/10 to-transparent border border-obsidian-primary/20">
                <div className="flex items-center gap-3 text-obsidian-primary mb-3">
                  <Heart size={20} className="fill-obsidian-primary" />
                  <span className="font-headline font-bold uppercase tracking-tight">Supporter Community</span>
                </div>
                <p className="text-obsidian-on-surface-variant text-sm italic font-light">
                   "VibeSync was built on the idea that sharing experiences should be effortless. Every donation directly impacts the quality of the service I provide to you."
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-obsidian-surface border border-obsidian-outline-variant/50 flex items-center justify-center text-[10px] font-bold text-obsidian-primary">AD</div>
                  <span className="text-xs font-bold text-white font-headline uppercase tracking-tight">Amit Dubey — Creator</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
