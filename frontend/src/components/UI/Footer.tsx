import React from 'react';
import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="bg-gradient-to-t from-obsidian-bg via-obsidian-bg to-obsidian-surface/20 w-full border-t border-obsidian-outline-variant/40 relative z-10 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row justify-between items-center px-8 py-12 gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center md:items-start gap-2">
          <span className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-obsidian-on-surface to-obsidian-primary font-headline tracking-tight uppercase">
            VibeSync
          </span>
          <p className="font-body text-xs tracking-normal text-obsidian-on-surface-variant">
            Watch parties, synchronized
          </p>
        </div>
        <div className="flex items-center gap-8 border-none md:border-r md:border-l px-0 md:px-8 border-obsidian-outline-variant/40 flex-wrap justify-center md:flex-nowrap">
          <Link
            href="/about"
            className="font-headline text-xs tracking-normal text-obsidian-on-surface-variant hover:text-obsidian-primary transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] uppercase"
          >
            About
          </Link>
          <Link
            href="/developer"
            className="font-headline text-xs tracking-normal text-obsidian-on-surface-variant hover:text-obsidian-primary transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] uppercase"
          >
            Developer
          </Link>
          <Link
            href="/privacy"
            className="font-headline text-xs tracking-normal text-obsidian-on-surface-variant hover:text-obsidian-primary transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] uppercase"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="font-headline text-xs tracking-normal text-obsidian-on-surface-variant hover:text-obsidian-primary transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] uppercase"
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="font-headline text-xs tracking-normal text-obsidian-on-surface-variant hover:text-obsidian-primary transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] uppercase"
          >
            Contact
          </Link>
          <Link
            href="/donate"
            className="font-headline text-xs font-bold tracking-normal text-obsidian-primary hover:text-obsidian-tertiary transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] uppercase"
          >
            Donate
          </Link>
        </div>
        <div className="flex gap-4">
          <span className="font-body text-xs tracking-normal text-obsidian-on-surface-variant/80 text-center md:text-right">
            Created by Amit Dubey <br className="md:hidden" /> with <span className="text-red-500">❤️</span> from India.
          </span>
        </div>
      </div>
    </footer>
  );
};
