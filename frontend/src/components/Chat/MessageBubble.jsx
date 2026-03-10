import { useRef, useState, useCallback } from 'react';
import { getInitials, getAvatarColor, formatMessageTime } from '../../utils/helpers';
import { Reply } from 'lucide-react';

// Swipe threshold — how many px to drag before triggering reply
const SWIPE_THRESHOLD = 55;
// Maximum visual translation so the bubble doesn't fly offscreen
const MAX_DRAG = 70;

const MessageBubble = ({ message, isOwn, onReply }) => {
  const [dragX, setDragX] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const startXRef = useRef(null);
  const isDraggingRef = useRef(false);
  const hasTriggeredRef = useRef(false);
  const rowRef = useRef(null);

  const triggerReply = useCallback(() => {
    if (!hasTriggeredRef.current && onReply) {
      hasTriggeredRef.current = true;
      // Light haptic feedback on supported devices
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
    // Only allow rightward swipe (positive delta)
    if (delta < 0) return;
    const clamped = Math.min(delta, MAX_DRAG);
    setDragX(clamped);

    // Pre-trigger the reply at threshold so it feels instant
    if (clamped >= SWIPE_THRESHOLD) {
      triggerReply();
    }
  }, [triggerReply]);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startXRef.current = null;
    // Spring back
    setIsSnapping(true);
    setDragX(0);
    setTimeout(() => setIsSnapping(false), 350);
  }, []);

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-text-muted bg-bg-hover px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const avatarBg = message.avatar || getAvatarColor(message.username);
  // How visible the reply hint is (0 → 1 as user swipes)
  const swipeProgress = Math.min(dragX / SWIPE_THRESHOLD, 1);

  return (
    <div
      ref={rowRef}
      className={`group flex gap-2 items-start animate-message-slide ${isOwn ? 'flex-row-reverse' : ''} mb-2 relative select-none`}
      style={{ touchAction: 'pan-y' }}
      // ── Touch (mobile) ─────────────────────────────────────────
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      // ── Mouse (desktop, for testing) ───────────────────────────
      onMouseDown={(e) => { if (e.button === 0) startDrag(e.clientX); }}
      onMouseMove={(e) => { if (e.buttons === 1) moveDrag(e.clientX); }}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      {/* Reply icon that appears behind the bubble as user swipes */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full
          bg-accent-purple/20 border border-accent-purple/40 text-accent-purple
          ${isOwn ? 'right-8' : 'left-8'}
          transition-all duration-150`}
        style={{
          width: `${24 + swipeProgress * 12}px`,
          height: `${24 + swipeProgress * 12}px`,
          opacity: swipeProgress,
        }}
        aria-hidden="true"
      >
        <Reply className="w-3.5 h-3.5" style={{ transform: `scale(${0.7 + swipeProgress * 0.5})` }} />
      </div>

      {/* Avatar */}
      <div
        className="avatar w-7 h-7 text-xs text-white shrink-0 mt-0.5"
        style={{ backgroundColor: avatarBg }}
      >
        {getInitials(message.username)}
      </div>

      {/* Bubble container — slides with drag */}
      <div
        className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5 relative`}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isSnapping ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
        }}
      >
        {!isOwn && (
          <span className="text-xs text-text-muted font-medium">{message.username}</span>
        )}

        <div
          className={`flex flex-col px-3 py-2 rounded-2xl text-sm leading-relaxed break-words relative overflow-hidden
            ${isOwn
              ? 'bg-accent-purple text-white rounded-tr-sm'
              : 'bg-bg-hover text-text-primary rounded-tl-sm'
            }`}
        >
          {message.replyTo && (
            <div className={`mb-1.5 pl-2 py-1 pr-2 rounded text-xs border-l-2 truncate cursor-pointer opacity-90
              ${isOwn
                ? 'bg-white/10 border-white/40 text-white'
                : 'bg-bg-secondary border-accent-purple text-text-secondary'}`}
            >
              <div className={`font-bold truncate ${isOwn ? 'text-white' : 'text-accent-purple'}`}>
                {message.replyTo.username}
              </div>
              <div className="truncate opacity-80">{message.replyTo.content}</div>
            </div>
          )}
          <span>{message.content}</span>
        </div>

        <span className="text-[10px] text-text-muted">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>

      {/* Desktop hover reply button (still available on non-touch) */}
      {onReply && (
        <button
          onClick={(e) => { e.stopPropagation(); onReply(message); }}
          className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-bg-secondary border border-border-dark text-text-muted shadow-sm hover:text-accent-purple hover:bg-bg-hover transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10
            ${isOwn ? 'right-[calc(100%+0.5rem)]' : 'left-[calc(100%+0.5rem)]'}
          `}
          title="Reply (or swipe right)"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default MessageBubble;
