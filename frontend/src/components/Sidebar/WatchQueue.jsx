import React, { useState } from 'react';
import { useWatchQueue } from '../../hooks/useWatchQueue';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { AnimatePresence, Reorder } from 'framer-motion';
import { resolveVideoUrl } from '../../utils/videoResolver';

export default function WatchQueue() {
  const { queue, suggestVideo, approveItem, removeItem, reorderQueue } = useWatchQueue();
  const { user } = useAuth();
  const { room } = useRoom();
  const [url, setUrl] = useState('');

  const isHost = room?.hostId === user?.id;
  const isCoHost = room?.coHosts?.includes(user?.id);
  const isPrivileged = isHost || isCoHost;

  const urlValidationResult = url.trim() ? resolveVideoUrl(url.trim()) : null;

  const handleSuggest = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    // Quick parse for basic type inference using videoResolver
    const resolved = resolveVideoUrl(url.trim());
    if (!resolved) return;

    suggestVideo({ 
      url: resolved.url, 
      title: resolved.title, 
      type: resolved.type 
    });
    setUrl('');
  };

  const handleReorder = (newQueueState) => {
    // Only privileged users can reorder
    if (!isPrivileged) return;
    reorderQueue(newQueueState.map(i => i.id));
  };

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border-l border-white/5 p-4">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-lg">Watch Queue</h3>
        <p className="text-zinc-500 text-[11px] uppercase tracking-wide font-headline mt-1">
          {isPrivileged 
            ? "Approve items to play them immediately." 
            : "Suggest videos to watch next."}
        </p>
      </div>

      <form onSubmit={handleSuggest} className="flex gap-2 mb-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste video URL..."
          className="flex-1 bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-6 py-2.5 text-sm font-bold transition-all shrink-0 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] font-headline uppercase tracking-widest"
        >
          {isPrivileged ? 'Add' : 'Suggest'}
        </button>
      </form>

      {/* Live type indicator */}
      {url.trim() && urlValidationResult && (
        <div className={`mb-4 -mt-2 flex items-center gap-1.5 text-xs font-medium ${
          urlValidationResult.type === 'unsupported'
            ? 'text-orange-400'
            : urlValidationResult.type === 'youtube'
              ? 'text-rose-500'
              : urlValidationResult.type === 'hls'
                ? 'text-fuchsia-500'
                : 'text-emerald-500'
        }`}>
          <span className="w-1.5 h-1.5 bg-current inline-block" />
          {urlValidationResult.type === 'youtube' && '▶ YouTube Video'}
          {urlValidationResult.type === 'direct' && '📁 Direct Video'}
          {urlValidationResult.type === 'hls' && '📡 HLS Stream'}
          {urlValidationResult.type === 'unsupported' && '⚠ Unsupported link'}
        </div>
      )}
      {url.trim() && !urlValidationResult && (
        <p className="mb-4 -mt-2 text-xs text-orange-400">⚠ Invalid or unrecognized URL</p>
      )}

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {queue.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-8 border border-dashed border-white/10 font-headline tracking-wide p-6">
            <svg className="w-8 h-8 mx-auto text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Queue is empty.
          </div>
        ) : (
          <Reorder.Group 
            axis="y" 
            values={queue} 
            onReorder={handleReorder}
            className="space-y-2"
          >
            <AnimatePresence>
              {queue.map((item) => (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  dragListener={isPrivileged}
                  className={`bg-white/5 backdrop-blur-md border ${item.status === 'approved' ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]' : 'border-white/5'} p-3 flex flex-col relative overflow-hidden`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm text-zinc-200 truncate font-headline tracking-wide" title={item.url}>
                        {item.title}
                      </p>
                      <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                        From: {item.suggestedBy} • {item.type}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {isPrivileged && item.status !== 'approved' && (
                        <button
                          onClick={() => approveItem(item.id)}
                          className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 transition-colors duration-200 hover:text-white transition-colors"
                          title="Play Immediately"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                      
                      {(isPrivileged || item.suggestedById === user?.id) && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 transition-colors duration-200 hover:text-white transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {isPrivileged && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col justify-center items-center cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 bg-black/20 opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100">
                      ⋮⋮
                    </div>
                  )}
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>
    </div>
  );
}
