import { useRef, useState, useCallback, useEffect } from 'react';
import { getInitials, getAvatarColor, formatMessageTime } from '../../utils/helpers';
import { Reply, Smile, Plus } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

// Swipe threshold — how many px to drag before triggering reply
const SWIPE_THRESHOLD = 55;
// Maximum visual translation so the bubble doesn't fly offscreen
const MAX_DRAG = 70;
// Emojis for quick reactions
const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageBubble = ({ message, isOwn, onReply }) => {
  const { reactToMessage } = useRoom();
  const [dragX, setDragX] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
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
      <div id={`msg-${message.id}`} className="flex justify-center my-2">
        <span className="text-xs text-text-muted bg-bg-hover px-3 py-1 rounded-full">
          {message.content}
        </span>
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

  const avatarBg = message.avatar || getAvatarColor(message.username);
  // How visible the reply hint is (0 → 1 as user swipes)
  const swipeProgress = Math.min(dragX / SWIPE_THRESHOLD, 1);

  return (
    <div
      id={`msg-${message.id}`}
      ref={rowRef}
      className={`group flex gap-2 items-start animate-message-slide ${isOwn ? 'flex-row-reverse' : ''} mb-4 relative select-none`}
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
            <div 
              onClick={scrollToOriginal}
              className={`mb-1.5 pl-2 py-1 pr-2 rounded text-xs border-l-2 cursor-pointer opacity-90 transition-all hover:bg-white/10 overflow-hidden
              ${isOwn
                ? 'bg-white/10 border-white/40 text-white'
                : 'bg-bg-secondary border-accent-purple text-text-secondary'}`}
            >
              <div className={`font-bold truncate ${isOwn ? 'text-white' : 'text-accent-purple'}`}>
                {message.replyTo.username}
              </div>
              <div className="line-clamp-2 break-all overflow-wrap-anywhere opacity-80">{message.replyTo.content}</div>
            </div>
          )}
          <span className="whitespace-pre-wrap break-all overflow-wrap-anywhere">{message.content}</span>
          
          {/* Reaction display */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => reactToMessage(message.id, emoji)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all border
                    ${users.includes(useRoom().user?.username)
                      ? 'bg-accent-purple/20 border-accent-purple/40 text-accent-purple' 
                      : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10'}`}
                >
                  <span>{emoji}</span>
                  {users.length > 1 && <span>{users.length}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-[10px] text-text-muted">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>

      {/* Desktop hover actions: Reply & React */}
      <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-20
        ${isOwn ? 'right-[calc(100%+0.5rem)] flex-row-reverse' : 'left-[calc(100%+0.5rem)]'}
      `}>
        {onReply && (
          <button
            onClick={(e) => { e.stopPropagation(); onReply(message); }}
            className="p-1.5 rounded-full bg-bg-secondary border border-border-dark text-text-muted shadow-sm hover:text-accent-purple hover:bg-bg-hover transition-all"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className={`p-1.5 rounded-full bg-bg-secondary border border-border-dark text-text-muted shadow-sm hover:text-accent-yellow hover:bg-bg-hover transition-all ${showReactionPicker ? 'text-accent-yellow bg-bg-hover' : ''}`}
          title="React"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>

        {/* Reaction Picker Overlay */}
        {showReactionPicker && (
          <div className={`absolute bottom-full mb-2 bg-bg-card border border-border-dark rounded-full px-2 py-1 shadow-xl flex items-center gap-1.5 animate-bounce-in
            ${isOwn ? 'right-0' : 'left-0'}
          `}>
            {REACTION_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  reactToMessage(message.id, emoji);
                  setShowReactionPicker(false);
                }}
                className="text-lg hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
