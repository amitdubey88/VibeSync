'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { formatRelativeTime } from '../../utils/helpers';
import {
  ReplyIcon,
  PinIcon,
} from "../UI/SharpIcons";
import { useRoom } from '../../context/RoomContext';
import { usePolls } from '../../hooks/usePolls';
import PollBubble from './PollBubble';

// Swipe threshold — how many px to drag before triggering reply
const SWIPE_THRESHOLD = 55;
// Maximum visual translation so the bubble doesn't fly offscreen
const MAX_DRAG = 70;
// Quick reaction options (first row in action bar)
const QUICK_REACTIONS = ['👍', '❤️', '😆', '😮', '😢', '🙏'];

// ── Tick icon based on message status ─────────────────────────────────────────
const StatusTick = ({ status, isOwn }) => {
  if (!isOwn) return null;
  const statusText = status === 'seen' ? 'READ' : status.toUpperCase();
  return (
    <span className="text-[10px] font-bold text-[#52525b] tracking-widest ml-1.5 uppercase">
      • {statusText}
    </span>
  );
};

const MessageBubble = ({ message, isOwn, onReply, onPin, prevMessage, isLastInGroup, isHost, isCoHost }) => {
  const { reactToMessage, messageStatuses } = useRoom();
  const { activePoll, votePoll, endPoll } = usePolls();
  const [dragX, setDragX] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const startXRef = useRef(null);
  const isDraggingRef = useRef(false);
  const hasTriggeredRef = useRef(false);
  const rowRef = useRef(null);
  const [displayTime, setDisplayTime] = useState(() => formatRelativeTime(message.createdAt));

  // Update display time every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayTime(formatRelativeTime(message.createdAt));
    }, 5 * 60 * 1000); // 5 mins
    return () => clearInterval(interval);
  }, [message.createdAt]);

  const status = messageStatuses?.[message.id] || 'sent';

  // Group detection: same sender consecutively
  const isContinuation = prevMessage &&
    prevMessage.type !== 'system' &&
    prevMessage.userId === message.userId &&
    (new Date(message.createdAt) - new Date(prevMessage.createdAt)) < 5 * 60 * 1000; // within 5 minutes

  const triggerReply = useCallback(() => {
    if (!hasTriggeredRef.current && onReply) {
      hasTriggeredRef.current = true;
      if (navigator.vibrate) navigator.vibrate(10);
      onReply(message);
    }
  }, [message, onReply]);

  const startDrag = useCallback((clientX) => {
    startXRef.current = clientX;
    isDraggingRef.current = true;
    hasTriggeredRef.current = false;
    setIsSnapping(false);
  }, []);

  const moveDrag = useCallback((clientX) => {
    if (!isDraggingRef.current || startXRef.current === null) return;
    const delta = clientX - startXRef.current;
    if (delta < 0) return;
    const clamped = Math.min(delta, MAX_DRAG);
    setDragX(clamped);
    if (clamped >= SWIPE_THRESHOLD) triggerReply();
  }, [triggerReply]);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startXRef.current = null;
    setIsSnapping(true);
    setDragX(0);
    setTimeout(() => setIsSnapping(false), 350);
  }, []);

  // Click outside to dismiss action bar
  useEffect(() => {
    if (!showActions) return;
    const handleOutside = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [showActions]);

  // ── System message ────────────────────────────────────────────────────────
  if (message.type === 'system') {
    return (
      <div id={`msg-${message.id}`} className="flex justify-center my-2">
        <span className="text-[10px] text-white/40 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest font-medium">
          {message.content}
        </span>
      </div>
    );
  }

  // ── Poll message (In-stream card) ──────────────────────────────────────────
  if (message.type === 'poll') {
    // Only render the card if it's the CURRENT active poll. 
    // If it's an old poll from history, we might want to show results only.
    // For now, let's just show the PollBubble.
    return (
      <div id={`msg-${message.id}`} className="flex justify-center my-4 animate-fade-in w-full px-4">
        <PollBubble 
          poll={activePoll?.id === message.pollId ? activePoll : { question: message.content, options: message.options || [], active: false }} 
          onVote={votePoll} 
          onEnd={endPoll} 
        />
      </div>
    );
  }

  const scrollToOriginal = () => {
    if (message.replyTo?.id) {
      const el = document.getElementById(`msg-${message.replyTo.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('animate-pulse-ring');
        setTimeout(() => el.classList.remove('animate-pulse-ring'), 2000);
      }
    }
  };


  const bubbleColors = isOwn
    ? 'bg-[#2d2d35]/60 border-white/10 text-white'
    : 'bg-[#1a1b1e]/90 border-white/10 text-white';

  const senderNameColor = '#8b5cf6'; // julian.x purple

  return (
    <div
      id={`msg-${message.id}`}
      ref={rowRef}
      className={`flex flex-col ${isOwn ? 'items-end ml-auto' : 'items-start mr-auto'} ${isContinuation ? 'mt-0.5' : 'mt-3'} relative select-none w-fit max-w-[85%]`}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      onMouseDown={(e) => { if (e.button === 0) startDrag(e.clientX); }}
      onMouseMove={(e) => { if (e.buttons === 1) moveDrag(e.clientX); }}
      onMouseUp={endDrag}
    >
      {/* Bubble area */}
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} relative w-full`}>
        {/* Sender name (only for first in group, not own) */}
        {!isOwn && !isContinuation && (
          <span className="text-[11px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: senderNameColor }}>
            {message.username}
          </span>
        )}

        <div className={`relative group/bubble ${isOwn ? 'ml-6' : 'mr-6'}`}>
          {/* Main bubble */}
          <div
            className={`flex flex-col px-3 py-2 md:px-4 md:py-3 ${bubbleColors} text-[14px] leading-relaxed break-words shadow-lg cursor-pointer min-w-[70px] border-2 relative`}
            style={{
              transform: `translateX(${dragX}px)`,
              transition: isSnapping ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              borderRadius: '12px',
            }}
            onClick={() => setShowActions(prev => !prev)}
          >
            {/* Reply preview */}
            {message.replyTo && (
              <div
                onClick={(e) => { e.stopPropagation(); scrollToOriginal(); }}
                className={`mb-2 pl-3 pr-2 py-1.5 border-l-2 cursor-pointer transition-all hover:brightness-110 overflow-hidden text-[12px]
                  ${isOwn ? 'bg-black/20 border-white/20 text-white/90' : 'bg-white/5 border-fuchsia-500/30 text-zinc-400'}`}
              >
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 truncate ${isOwn ? 'text-white/70' : 'text-fuchsia-400'}`}>
                  {message.replyTo.username}
                </div>
                <div className="line-clamp-1 opacity-60 leading-tight">
                  {message.replyTo.content}
                </div>
              </div>
            )}

            {/* Message text or GIF */}
            {message.type === 'gif' ? (
              <div className="mt-1 mb-1 relative overflow-hidden border border-white/5 group-hover/bubble:brightness-110 transition-all">
                <img src={message.content} alt={message.title || 'GIF'} className="max-w-full h-auto min-w-[150px] object-cover" loading="lazy" />
              </div>
            ) : (
              <span className="whitespace-pre-wrap font-body font-medium">{message.content}</span>
            )}
          </div>

          {/* Reactions overlapping bottom corner of bubble */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className={`absolute bottom-[-14px] ${isOwn ? 'left-[-4px]' : 'right-[-4px]'} flex flex-wrap gap-1 z-20`}>
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <div
                  key={emoji}
                  title={users.join(', ')}
                  className="flex items-center gap-1 bg-[#1a1a1d] border border-white/10 px-2 py-0.5 shadow-2xl scale-110 rounded-full"
                >
                  <span className="text-[#a78bfa] text-[10px]">{emoji}</span>
                  {users.length > 1 && <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{users.length}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp row — OUTSIDE bubble, shown only if last in group or significant gap */}
        {isLastInGroup && (
          <div className={`flex items-center mt-2 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] font-bold text-[#52525b] tracking-widest">
              {displayTime}
            </span>
            <StatusTick status={status} isOwn={isOwn} />
          </div>
        )}

        {/* Hover action bar — appears on hover (desktop) or tap (mobile) */}
        {showActions && (
          <div
            className={`absolute -top-12 flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.8)] z-40 animate-fade-in
              ${isOwn ? 'right-0' : 'left-0'} max-w-[calc(100vw-3rem)] md:max-w-none`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick reactions */}
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { reactToMessage(message.id, emoji); setShowActions(false); }}
                className="text-lg hover:scale-125 transition-transform active:scale-150 p-0.5 "
              >
                {emoji}
              </button>
            ))}

            <div className="w-px h-4 bg-white/10 mx-1" />

            {/* Reply */}
            {onReply && (
              <button
                onClick={() => { onReply(message); setShowActions(false); }}
                className="p-1.5 text-obsidian-on-surface-variant hover:text-white hover:bg-white/10 transition-all font-black"
                title="Reply"
              >
                <ReplyIcon size={14} />
              </button>
            )}

            {/* Pin */}
            {(isHost || isCoHost) && onPin && (
              <button
                onClick={() => { onPin(message.id); setShowActions(false); }}
                className="p-1.5 text-obsidian-on-surface-variant hover:text-obsidian-primary hover:bg-white/10 transition-all"
                title="Pin message"
              >
                <PinIcon size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
