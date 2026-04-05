import type { Metadata } from 'next';
import RoomClient from './RoomClient';

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * Server Component shell for /room/[code].
 * Fetches room name server-side for OG metadata.
 * Sets noindex — room URLs are ephemeral/private, not for search indexing.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;

  let roomName = code.toUpperCase();
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
    const res = await fetch(`${apiUrl}/api/rooms/${code}`, {
      next: { revalidate: 0 }, // always fresh — room state is ephemeral
    });
    if (res.ok) {
      const data = await res.json();
      roomName = data?.room?.name ?? roomName;
    }
  } catch {
    // Fall back to room code
  }

  return {
    title: `${roomName} — VibeSync Room`,
    description: `Join the VibeSync watch party: ${roomName}. Watch together in real time.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${roomName} — VibeSync Room`,
      description: `Join the VibeSync watch party: ${roomName}`,
    },
  };
}

export default async function RoomPage({ params }: PageProps) {
  const { code } = await params;
  return <RoomClient code={code} />;
}
