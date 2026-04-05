import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, Manrope } from 'next/font/google';
import '../src/index.css';
import { Providers } from './providers';

// Google Fonts via next/font — zero-CLS, self-hosted automatically
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});


const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibesync.app'
  ),
  title: {
    default: 'VibeSync — Watch Together, Live',
    template: '%s | VibeSync',
  },
  description:
    'VibeSync is the real-time watch party platform for movies, shows, and live streams. Create a room, invite friends, and sync every frame.',
  keywords: ['watch party', 'watch together', 'video sync', 'stream together', 'vibesync'],
  authors: [{ name: 'VibeSync' }],
  creator: 'VibeSync',
  openGraph: {
    type: 'website',
    siteName: 'VibeSync',
    title: 'VibeSync — Watch Together, Live',
    description:
      'Real-time synchronized watch parties. Movies, shows, streams — watch with friends, perfectly in sync.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VibeSync — Watch Together, Live',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeSync — Watch Together, Live',
    description:
      'Real-time synchronized watch parties. Movies, shows, streams — watch with friends, perfectly in sync.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${manrope.variable}`}
    > <head><meta name="google-site-verification" content="69zyFhWkvghMbU0K1n0cti6E7NMTFz45QLcIQE86U14" /></head>
      <body className="min-h-screen bg-[#0a0a0b] text-zinc-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
