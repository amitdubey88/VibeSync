'use client';

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
    <div className="flex flex-col h-full bg-gradient-to-b from-obsidian-surface/40 to-obsidian-bg/30 backdrop-blur-xl border-l border-obsidian-primary/15 p-4">
      <div className="mb-4">
        <h3 className="text-obsidian-on-surface font-semibold text-lg">Watch Queue</h3>
        <p className="text-obsidian-on-surface-variant text-[11px] uppercase tracking-wider font-headline mt-1">
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
          className="flex-1 bg-obsidian-surface/50 border border-obsidian-primary/20 px-4 py-2.5 text-sm text-obsidian-on-surface placeholder:text-obsidian-on-surface-variant focus:outline-none focus:border-obsidian-primary focus:ring-1 focus:ring-obsidian-primary/30 transition-all rounded-lg"
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="btn-primary disabled:opacity-50 px-6 py-2.5 text-sm shrink-0 font-headline uppercase tracking-widest"
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
          <div className="text-center text-obsidian-on-surface-variant text-sm mt-8 border border-dashed border-obsidian-primary/20 font-headline tracking-wide p-6 rounded-lg bg-obsidian-primary/5">
            <svg className="w-8 h-8 mx-auto text-obsidian-primary/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  className={`glass backdrop-blur-md border transition-all duration-200 ${item.status === 'approved' ? 'border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-emerald-500/5' : 'border-obsidian-primary/20'} p-3 flex flex-col relative overflow-hidden rounded-lg hover:border-obsidian-primary/30`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm text-obsidian-on-surface truncate font-headline tracking-wide" title={item.url}>
                        {item.title}
                      </p>
                      <p className="text-[9px] text-obsidian-on-surface-variant mt-1 uppercase tracking-wider font-mono">
                        From: {item.suggestedBy} • {item.type}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isPrivileged && item.status !== 'approved' && (
                        <button
                          onClick={() => approveItem(item.id)}
                          className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 text-emerald-400 hover:from-emerald-500/30 hover:to-emerald-500/15 hover:text-emerald-300 transition-all duration-200 rounded-lg hover:shadow-[0_0_12px_rgba(16,185,129,0.25)]"
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
                          className="p-2 bg-gradient-to-br from-red-500/15 to-red-500/8 text-red-400 hover:from-red-500/25 hover:to-red-500/12 hover:text-red-300 transition-all duration-200 rounded-lg hover:shadow-[0_0_12px_rgba(239,68,68,0.2)]"
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
