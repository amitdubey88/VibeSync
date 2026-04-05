import type { Metadata } from 'next';
import Script from 'next/script';
import LandingPage from '../src/views/LandingPage';

// Disable static prerendering — LandingPage accesses `document` at init
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'VibeSync - Real-time Sync Watch Parties & Video Streaming',
  description:
    'VibeSync is a fast, real-time web application for synchronized video streaming and watch parties. Connect with friends securely via WebRTC to watch movies and YouTube together perfectly in sync.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'VibeSync - Real-time Sync Watch Parties',
    description:
      'Create instant watch party rooms. Sync movies, shows, and streams with friends in real time. Fast, secure, and completely synchronized.',
    url: '/',
    type: 'website',
  },
};

// JSON-LD structured data for the homepage
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'VibeSync',
  url: 'https://vibesync.app',
  description:
    'VibeSync is a real-time web application that allows users to sync data, collaborate instantly, and watch videos together securely across devices.',
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

/**
 * Server Component shell for the homepage.
 * Exports metadata so <title> and <meta> are in HTML before JS runs.
 * Renders <LandingPage> which is a Client Component ('use client').
 */
export default function Page() {
  return (
    <>
      <Script
        id="website-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <LandingPage />
    </>
  );
}
