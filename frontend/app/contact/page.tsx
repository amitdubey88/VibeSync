import Link from 'next/link';
import { Mail, MessageSquare, Twitter, Globe } from 'lucide-react';

export const metadata = {
  title: 'Contact Us — VibeSync',
  description: 'Get in touch with the VibeSync team.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-obsidian-background text-obsidian-on-surface font-body pt-24 pb-16 px-6 relative overflow-hidden">
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

        <div className="grid md:grid-cols-2 gap-8">
          {/* Email Trigger Card */}
          <a 
            href="mailto:contact@vibesync.app?subject=Hello%20VibeSync%20Team!"
            className="glass-panel p-8 rounded-3xl border border-obsidian-outline-variant/30 shadow-[0_15px_50px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center text-center group hover:bg-obsidian-surface hover:border-obsidian-primary/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(168,85,247,0.15)]"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-obsidian-primary/20 to-obsidian-tertiary/10 border border-obsidian-primary/30 flex items-center justify-center mb-6 text-obsidian-primary group-hover:scale-110 transition-transform duration-300">
              <Mail size={28} />
            </div>
            <h3 className="text-2xl font-bold text-white font-headline tracking-wide uppercase mb-3">
              Email Us
            </h3>
            <p className="text-obsidian-on-surface-variant mb-6 text-sm">
              The fastest way to reach us for support, feature requests, or business inquiries.
            </p>
            <span className="text-obsidian-primary font-headline text-sm tracking-widest uppercase font-semibold group-hover:text-obsidian-tertiary transition-colors">
              contact@vibesync.app
            </span>
          </a>

          {/* Social Feedback Card */}
          <div className="glass-panel p-8 rounded-3xl border border-obsidian-outline-variant/30 shadow-[0_15px_50px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center text-center">
            <h3 className="text-xl font-bold text-white font-headline tracking-wide uppercase mb-6">
              Connect With Us
            </h3>
            <div className="flex flex-col gap-4 w-full">
              <a href="https://github.com/amitdubey88/VibeSync" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-xl border border-obsidian-outline-variant/20 bg-obsidian-background/50 hover:bg-obsidian-primary/10 hover:border-obsidian-primary/40 transition-all group">
                <Globe className="text-obsidian-on-surface-variant group-hover:text-obsidian-primary transition-colors" size={20} />
                <span className="font-semibold text-sm tracking-wide text-obsidian-on-surface-variant group-hover:text-white transition-colors">GitHub Discussions</span>
              </a>
              <a href="#" className="flex items-center gap-4 p-4 rounded-xl border border-obsidian-outline-variant/20 bg-obsidian-background/50 hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all group">
                <Twitter className="text-obsidian-on-surface-variant group-hover:text-cyan-400 transition-colors" size={20} />
                <span className="font-semibold text-sm tracking-wide text-obsidian-on-surface-variant group-hover:text-white transition-colors">Twitter Support @VibeSync</span>
              </a>
              <a href="#" className="flex items-center gap-4 p-4 rounded-xl border border-obsidian-outline-variant/20 bg-obsidian-background/50 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all group">
                <MessageSquare className="text-obsidian-on-surface-variant group-hover:text-indigo-400 transition-colors" size={20} />
                <span className="font-semibold text-sm tracking-wide text-obsidian-on-surface-variant group-hover:text-white transition-colors">Join Discord Community</span>
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
