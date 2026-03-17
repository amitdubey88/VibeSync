import { useRef, useState, useCallback, useEffect } from 'react';
import { getInitials, getAvatarColor, formatMessageTime } from '../../utils/helpers';
import { Reply, ShieldCheck, Check, CheckCheck } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

// Swipe threshold — how many px to drag before triggering reply
const SWIPE_THRESHOLD = 55;
// Maximum visual translation so the bubble doesn't fly offscreen
const MAX_DRAG = 70;
// Quick reaction options (first row in action bar)
const QUICK_REACTIONS = ['👍', '❤️', '😆', '😮', '😢', '🙏'];
// Extended reaction picker
const MORE_REACTIONS = ['😂', '💀', '🔥', '🤡', '😭', '💯', '✨', '🎉', '🫶'];

// ── Tick icon based on message status ─────────────────────────────────────────
const StatusTick = ({ status, isOwn }) => {
  if (!isOwn) return null;
  if (status === 'seen') {
    return <CheckCheck className="w-3 h-3 text-blue-400 shrink-0" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="w-3 h-3 text-white/50 shrink-0" />;
  }
  // sent (default)
  return <Check className="w-3 h-3 text-white/40 shrink-0" />;
};

const MessageBubble = ({ message, isOwn, onReply, prevMessage }) => {
  const { reactToMessage, messageStatuses, user } = useRoom();
  const [dragX, setDragX] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showMoreEmoji, setShowMoreEmoji] = useState(false);
  const startXRef = useRef(null);
  const isDraggingRef = useRef(false);
  const hasTriggeredRef = useRef(false);
  const rowRef = useRef(null);

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
    if (!showActions && !showMoreEmoji) return;
    const handleOutside = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setShowActions(false);
        setShowMoreEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [showActions, showMoreEmoji]);

  // ── System message ────────────────────────────────────────────────────────
  if (message.type === 'system') {
    return (
      <div id={`msg-${message.id}`} className="flex justify-center my-1.5">
        <span className="text-[11px] text-text-muted bg-bg-hover/60 px-3 py-1 rounded-full">
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
  const swipeProgress = Math.min(dragX / SWIPE_THRESHOLD, 1);

  // WhatsApp-style bubble radius: own messages have sharp top-right, others have sharp top-left
  const bubbleRadius = isOwn
    ? isContinuation ? 'rounded-[18px]' : 'rounded-[18px] rounded-tr-[4px]'
    : isContinuation ? 'rounded-[18px]' : 'rounded-[18px] rounded-tl-[4px]';

  const bubbleColors = isOwn
    ? 'bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white'
    : 'bg-[#1e1e2d] text-text-primary border border-white/[0.06]';

  return (
    <div
      id={`msg-${message.id}`}
      ref={rowRef}
      className={`flex gap-2 items-end ${isOwn ? 'flex-row-reverse' : ''} ${isContinuation ? 'mt-0.5' : 'mt-3'} relative select-none`}
      style={{ touchAction: 'pan-y' }}
      // Touch gestures for swipe-to-reply
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      onMouseDown={(e) => { if (e.button === 0) startDrag(e.clientX); }}
      onMouseMove={(e) => { if (e.buttons === 1) moveDrag(e.clientX); }}
      onMouseUp={endDrag}
    >
      {/* Reply hint behind bubble */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-accent-purple/20 border border-accent-purple/40 text-accent-purple ${isOwn ? 'right-10' : 'left-10'} pointer-events-none`}
        style={{
          width: `${22 + swipeProgress * 12}px`,
          height: `${22 + swipeProgress * 12}px`,
          opacity: swipeProgress,
        }}
      >
        <Reply className="w-3 h-3" style={{ transform: `scale(${0.7 + swipeProgress * 0.5})` }} />
      </div>

      {/* Avatar — only shown for first in group and non-own */}
      {!isOwn ? (
        <div
          className={`avatar w-7 h-7 text-[9px] text-white shrink-0 shadow-md ${isContinuation ? 'opacity-0 pointer-events-none' : ''}`}
          style={{ backgroundColor: avatarBg }}
          title={message.username}
        >
          {getInitials(message.username)}
        </div>
      ) : (
        // Spacer to keep own messages aligned right without avatar
        <div className="w-7 shrink-0" />
      )}

      {/* Bubble area */}
      <div className={`max-w-[78%] flex flex-col ${isOwn ? 'items-end' : 'items-start'} relative`}>
        {/* Sender name (only for first in group, not own) */}
        {!isOwn && !isContinuation && (
          <span className="text-[11px] font-semibold ml-1 mb-0.5" style={{ color: avatarBg }}>
            {message.username}
          </span>
        )}

        <div className="relative group/bubble">
          {/* Main bubble */}
          <div
            className={`flex flex-col px-3 py-2 ${bubbleRadius} ${bubbleColors} text-[14px] leading-[1.45] break-words shadow-sm cursor-pointer min-w-[60px]`}
            style={{
              transform: `translateX(${dragX}px)`,
              transition: isSnapping ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
            onClick={() => setShowActions(prev => !prev)}
          >
            {/* Reply preview */}
            {message.replyTo && (
              <div
                onClick={(e) => { e.stopPropagation(); scrollToOriginal(); }}
                className={`mb-1.5 pl-2.5 pr-2 py-1 rounded-lg border-l-[3px] cursor-pointer transition-all hover:brightness-110 overflow-hidden text-[12px]
                  ${isOwn ? 'bg-black/20 border-white/50 text-white/90' : 'bg-white/5 border-accent-purple/60 text-text-secondary'}`}
              >
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 truncate ${isOwn ? 'text-white/70' : 'text-accent-purple'}`}>
                  {message.replyTo.username}
                </div>
                <div className="line-clamp-1 opacity-75 leading-tight">
                  {message.replyTo.content}
                </div>
              </div>
            )}

            {/* Message text */}
            <span className="whitespace-pre-wrap">{message.content}</span>

            {/* Timestamp + E2EE + Ticks row (inside bubble, WhatsApp-style) */}
            <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-end'}`}>
              {message.e2ee && (
                <ShieldCheck className={`w-2.5 h-2.5 shrink-0 ${isOwn ? 'text-white/40' : 'text-text-muted/40'}`} title="E2EE" />
              )}
              <span className={`text-[10px] select-none ${isOwn ? 'text-white/50' : 'text-text-muted/60'}`}>
                {formatMessageTime(message.createdAt)}
              </span>
              <StatusTick status={status} isOwn={isOwn} />
            </div>
          </div>

          {/* Reactions floating below bubble */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className={`flex flex-wrap gap-0.5 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); reactToMessage(message.id, emoji); }}
                  title={users.join(', ')}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all
                    ${users.includes(user?.username)
                      ? 'bg-accent-purple/20 border-accent-purple/50 text-accent-purple'
                      : 'bg-bg-hover border-white/10 text-text-muted hover:bg-white/10'}`}
                >
                  <span>{emoji}</span>
                  {users.length > 1 && <span className="text-[10px]">{users.length}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Hover action bar — appears on hover (desktop) or tap (mobile) */}
          {showActions && (
            <div
              className={`absolute -top-10 flex items-center gap-0.5 px-2 py-1.5 rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl z-40 animate-fade-in
                ${isOwn ? 'right-0' : 'left-0'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Quick reactions */}
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { reactToMessage(message.id, emoji); setShowActions(false); }}
                  className="text-lg hover:scale-125 transition-transform active:scale-150 p-0.5 rounded-lg"
                >
                  {emoji}
                </button>
              ))}

              <div className="w-px h-4 bg-white/10 mx-1" />

              {/* More emojis */}
              <button
                onClick={() => setShowMoreEmoji(p => !p)}
                className={`p-1 rounded-lg text-text-muted hover:text-accent-yellow hover:bg-white/5 transition-all text-sm ${showMoreEmoji ? 'text-accent-yellow' : ''}`}
                title="More reactions"
              >
                +
              </button>

              {/* Reply */}
              {onReply && (
                <button
                  onClick={() => { onReply(message); setShowActions(false); }}
                  className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all"
                  title="Reply"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* More emoji picker */}
          {showMoreEmoji && (
            <div
              className={`absolute -top-20 flex flex-wrap max-w-[200px] gap-1 px-3 py-2 rounded-2xl bg-[#13131f] border border-white/10 shadow-2xl z-50 animate-fade-in
                ${isOwn ? 'right-0' : 'left-0'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {MORE_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { reactToMessage(message.id, emoji); setShowMoreEmoji(false); setShowActions(false); }}
                  className="text-lg hover:scale-125 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
