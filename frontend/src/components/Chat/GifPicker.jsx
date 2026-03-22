import React, { useState, useEffect, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function GifPicker({ isOpen, onClose, onSelect }) {
  const [gifs, setGifs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef(null);

  // MVP: Free public Tenor API key for testing/dev
  const TENOR_KEY = 'LIVDSRZULELA'; 
  const LIMIT = 24;

  useEffect(() => {
    if (!isOpen) return;

    const fetchGifs = async () => {
      setLoading(true);
      try {
        const endpoint = search.trim() 
          ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(search)}&key=${TENOR_KEY}&limit=${LIMIT}`
          : `https://g.tenor.com/v1/trending?key=${TENOR_KEY}&limit=${LIMIT}`;
          
        const res = await fetch(endpoint);
        const data = await res.json();
        if (data.results) {
          setGifs(data.results);
        }
      } catch (err) {
        console.error('GIF API error', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(fetchGifs, 400);
    return () => clearTimeout(timer);
  }, [search, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Motion.div 
        ref={pickerRef}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="absolute bottom-14 right-2 w-72 h-80 bg-[#0a0a0b]/95 backdrop-blur-3xl border border-white/5  shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden z-50"
      >
        <div className="p-2 border-b border-white/5 bg-transparent">
          <input
            type="text"
            placeholder="Search Tenor GIFs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-white/5  px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-fuchsia-500 font-headline transition-colors"
            autoFocus
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-white/10 custom-scrollbar">
          {loading ? (
            <div className="w-full h-full flex justify-center items-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent  animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {gifs.map(gif => (
                <button
                  key={gif.id}
                  onClick={() => {
                    const url = gif.media[0]?.gif?.url || gif.media[0]?.tinygif?.url;
                    if (url) onSelect(url, gif.title);
                  }}
                  className="w-full h-24 bg-white/5  overflow-hidden hover:opacity-80 transition-opacity overflow-hidden focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <img 
                    src={gif.media[0]?.tinygif?.url} 
                    alt={gif.title} 
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </Motion.div>
    </AnimatePresence>
  );
}
