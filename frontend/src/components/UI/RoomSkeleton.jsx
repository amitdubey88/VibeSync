const RoomSkeleton = () => {
  return (
    <div className="h-screen flex flex-col bg-[#0a0a0b] overflow-hidden animate-fade-in">
      {/* Header Skeleton */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#0a0a0b]/90 backdrop-blur-2xl border-white/5 shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/5  animate-pulse" />
          <div className="w-20 h-4 bg-white/5 rounded animate-pulse hidden sm:block" />
          <div className="w-px h-5 bg-border-dark" />
          <div className="w-32 h-4 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-8 bg-white/5  animate-pulse" />
          <div className="w-16 h-8 bg-white/5  animate-pulse" />
          <div className="w-24 h-8 bg-white/5  hidden md:block" />
        </div>
      </header>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video Area Skeleton */}
        <div className="flex-1 bg-black/95 relative flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-white/5  animate-pulse-glow" />
            <div className="w-48 h-4 bg-white/5 rounded animate-pulse" />
          </div>
          {/* Controls Placeholder */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/95/40 px-4 flex items-center gap-4">
            <div className="w-8 h-8 bg-white/5  animate-pulse" />
            <div className="w-8 h-8 bg-white/5  animate-pulse" />
            <div className="flex-1 h-2 bg-white/5  animate-pulse" />
            <div className="w-24 h-4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="hidden md:flex md:w-80 xl:w-96 flex-col border-l border-white/5 bg-[#0a0a0b]/50 backdrop-blur-3xl">
          <div className="p-4 border-b border-white/5 flex gap-2">
            <div className="flex-1 h-8 bg-white/5 rounded animate-pulse" />
            <div className="flex-1 h-8 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="flex-1 p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 bg-white/5  animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-20 h-3 bg-white/5 rounded animate-pulse" />
                  <div className="w-full h-10 bg-white/5  animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-white/5">
             <div className="h-10 bg-white/5  animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomSkeleton;
