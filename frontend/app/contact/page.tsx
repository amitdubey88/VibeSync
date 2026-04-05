import Link from 'next/link';
import { Mail, MessageSquare, Twitter, Globe } from 'lucide-react';

export const metadata = {
  title: 'Contact Us — VibeSync',
  description: 'Get in touch with the VibeSync team.',
};

import { Footer } from '../../src/components/UI/Footer';

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-obsidian-background text-obsidian-on-surface font-body">
      <main className="flex-grow pt-24 pb-16 px-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-obsidian-primary/5 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10">
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-obsidian-primary hover:text-obsidian-tertiary transition-colors mb-8 text-sm font-semibold tracking-wider font-headline uppercase group">
            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-obsidian-primary to-obsidian-tertiary font-headline uppercase mb-6 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] text-center">
            Get In Touch
          </h1>
          <p className="text-center text-obsidian-on-surface-variant max-w-xl mx-auto text-lg leading-relaxed">
            Have a question, feedback, or just want to say hi? We'd love to hear from you. Drop us an email and we'll get back to you as soon as possible.
          </p>
        </div>

        <div className="flex justify-center max-w-xl mx-auto">
          {/* Email Trigger Card */}
          <a 
            href="mailto:amitdubey88@gmail.com?subject=Hello%20VibeSync%20Team!"
            className="w-full glass-panel p-10 md:p-14 rounded-[2rem] border border-obsidian-outline-variant/30 shadow-[0_15px_50px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center text-center group hover:bg-obsidian-surface hover:border-obsidian-primary/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(168,85,247,0.15)] relative overflow-hidden"
          >
            {/* Hover Glow Effect inside card */}
            <div className="absolute inset-0 bg-gradient-to-b from-obsidian-primary/0 to-obsidian-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-obsidian-primary/20 to-obsidian-tertiary/10 border border-obsidian-primary/30 flex items-center justify-center mb-8 text-obsidian-primary group-hover:scale-110 transition-transform duration-300 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
              <Mail size={32} />
            </div>
            <h3 className="text-3xl font-bold text-white font-headline tracking-wide uppercase mb-4">
              Send an Email
            </h3>
            <p className="text-obsidian-on-surface-variant mb-8 text-base md:text-lg max-w-sm">
              The fastest way to reach me for support, feature requests, or business inquiries.
            </p>
            <span className="inline-block px-6 py-3 rounded-full bg-obsidian-background/50 border border-obsidian-outline-variant/50 text-obsidian-primary font-headline text-sm tracking-widest uppercase font-semibold group-hover:border-obsidian-primary/50 group-hover:text-obsidian-tertiary transition-colors">
              amitdubey88@gmail.com
            </span>
          </a>
        </div>

      </div>
      </main>
      <Footer />
    </div>
  );
}
