import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center text-center px-6">
      <div className="text-8xl font-headline font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-purple-600 mb-4">
        404
      </div>
      <h1 className="text-2xl font-headline text-zinc-100 mb-2">
        Room Not Found
      </h1>
      <p className="text-zinc-400 mb-8 max-w-md">
        This room doesn&apos;t exist or has expired. Head back to the home page to create or join a room.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-headline font-semibold text-sm tracking-widest uppercase transition-colors"
      >
        Back to VibeSync
      </Link>
    </div>
  );
}
