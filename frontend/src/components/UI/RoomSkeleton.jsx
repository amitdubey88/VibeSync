'use client';

const RoomSkeleton = () => {
  return (
    <div className="h-screen flex flex-col bg-obsidian-bg overflow-hidden animate-fade-in font-inter">
      {/* Header Skeleton */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-obsidian-bg/80 backdrop-blur-3xl shrink-0 gap-4">
        <div className="flex items-center gap-3">
          {/* Logo Placeholder */}
          <div className="w-8 h-8 rounded-lg skeleton opacity-80" />
          <div className="w-24 h-5 skeleton hidden sm:block" />
          <div className="w-px h-6 bg-white/10 mx-1" />
          {/* Room Name Placeholder */}
          <div className="w-40 h-5 skeleton" />
        </div>

        <div className="flex items-center gap-3">
          {/* Status Group */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <div className="w-4 h-4 rounded-full skeleton" />
            <div className="w-12 h-3 skeleton" />
          </div>
          {/* Action Buttons */}
          <div className="w-20 h-9 rounded-xl skeleton" />
          <div className="w-20 h-9 rounded-xl skeleton" />
          <div className="w-10 h-10 rounded-xl skeleton" />
        </div>
      </header>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Video Area Skeleton */}
        <div className="flex-1 bg-obsidian-bg/95 relative flex items-center justify-center overflow-hidden">
          {/* Cinematic Background Glows */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-obsidian-primary/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-obsidian-tertiary/10 blur-[120px] rounded-full animate-pulse" />
          
          <div className="flex flex-col items-center gap-6 relative z-10">
            {/* Center Play/Logo Icon */}
            <div className="w-20 h-20 rounded-3xl skeleton opacity-40 rotate-[15deg]" />
            <div className="w-56 h-4 skeleton opacity-60" />
          </div>

          {/* Video Controls Skeleton */}
          <div className="absolute bottom-6 left-6 right-6 h-14 glass-blur rounded-2xl px-6 flex items-center gap-5 border border-white/5">
            <div className="w-6 h-6 rounded-lg skeleton opacity-80" />
            <div className="w-6 h-6 rounded-lg skeleton opacity-80" />
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden relative">
              <div className="absolute inset-0 skeleton opacity-40 shrink-0" />
            </div>
            <div className="w-32 h-4 skeleton hidden sm:block opacity-60" />
            <div className="w-8 h-8 rounded-lg skeleton opacity-80" />
          </div>

          {/* Top Video Overlays */}
          <div className="absolute top-6 left-6 flex gap-3">
             <div className="w-28 h-8 rounded-full skeleton" />
             <div className="w-20 h-8 rounded-full skeleton" />
          </div>
        </div>

        {/* Sidebar Skeleton (Right side) */}
        <div className="hidden lg:flex w-80 xl:w-96 flex-col border-l border-white/5 bg-obsidian-surface-dim/40 backdrop-blur-3xl shrink-0">
          {/* Tabs Section */}
          <div className="p-4 border-b border-white/5 flex gap-3">
            <div className="flex-1 h-10 rounded-xl skeleton" />
            <div className="flex-1 h-10 rounded-xl skeleton" />
          </div>

          {/* Participant/Chat List Placeholder */}
          <div className="flex-1 p-5 space-y-6 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl skeleton shrink-0" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <div className="w-24 h-3.5 skeleton" />
                  <div className="w-full h-12 rounded-xl skeleton opacity-50" />
                </div>
              </div>
            ))}
          </div>

          {/* Input/Footer Section */}
          <div className="p-4 border-t border-white/5 bg-obsidian-bg/40">
             <div className="h-12 rounded-xl skeleton border border-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomSkeleton;
