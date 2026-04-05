import type { Metadata } from 'next';
import Script from 'next/script';
import LandingPage from '../src/pages/LandingPage';

export const metadata: Metadata = {
  title: 'Watch Together, Live — VibeSync',
  description:
    'Create instant watch party rooms. Sync movies, shows, and streams with friends in real time. No downloads, no lag, just vibes.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'VibeSync — Watch Together, Live',
    description:
      'Create instant watch party rooms. Sync movies, shows, and streams with friends in real time.',
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
    'Real-time synchronized watch parties for movies, shows, and live streams.',
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
