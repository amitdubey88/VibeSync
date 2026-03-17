import { useRef, useState, useCallback, useEffect } from 'react';
import { getInitials, getAvatarColor, formatMessageTime } from '../../utils/helpers';
import { Reply, SmilePlus, Plus, ShieldCheck } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

// Swipe threshold — how many px to drag before triggering reply
const SWIPE_THRESHOLD = 55;
// Maximum visual translation so the bubble doesn't fly offscreen
const MAX_DRAG = 70;
// Emojis for quick reactions
const REACTION_OPTIONS = ['👍', '❤️', '😆', '😮', '😢', '🙏'];

const MessageBubble = ({ message, isOwn, onReply }) => {
  const { reactToMessage } = useRoom();
  const [dragX, setDragX] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
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

  // Click outside to dismiss
  useEffect(() => {
    if (!showActions && !showReactionPicker) return;
    
    const handleOutsideClick = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setShowActions(false);
        setShowReactionPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showActions, showReactionPicker]);

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
      role="button"
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowReactionPicker(false); setShowActions(false); endDrag(); }}
      className={`group flex gap-2 items-start animate-message-slide ${isOwn ? 'flex-row-reverse' : ''} mb-4 relative select-none cursor-pointer outline-none`}
      style={{ touchAction: 'pan-y' }}
      onClick={() => setShowActions(!showActions)}
      // ── Touch (mobile) ─────────────────────────────────────────
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      // ── Mouse (desktop, for testing) ───────────────────────────
      onMouseDown={(e) => { if (e.button === 0) startDrag(e.clientX); }}
      onMouseMove={(e) => { if (e.buttons === 1) moveDrag(e.clientX); }}
      onMouseUp={endDrag}
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

      {/* Avatar with subtle glow/ring */}
      <div
        className="avatar w-8 h-8 text-[10px] text-white shrink-0 mt-0.5 shadow-lg border border-white/10 ring-2 ring-white/5"
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
        {/* Username for messages from others */}
        {!isOwn && (
          <span className="text-[11px] text-text-muted font-bold ml-1 mb-0.5 tracking-tight uppercase opacity-80">
            {message.username}
          </span>
        )}

        <div
          className={`flex flex-col px-3 py-1.5 rounded-2xl text-[13px] leading-[1.4] break-words relative overflow-hidden shadow-md transition-shadow group-hover:shadow-lg
            ${isOwn
              ? 'bg-[#2b2b40] text-white rounded-tr-sm border border-white/10'
              : 'bg-[#1a1a2e] text-text-primary rounded-tl-sm border border-white/5'
            }`}
        >
          {message.replyTo && (
            <div 
              onClick={scrollToOriginal}
              className={`mb-2 pl-2.5 py-1.5 pr-2.5 rounded-xl border-l-4 cursor-pointer transition-all hover:brightness-110 overflow-hidden relative
              ${isOwn
                ? 'bg-black/20 border-white/30 text-white/90'
                : 'bg-white/5 border-accent-purple text-text-secondary shadow-inner'}`}
            >
              <div className={`text-[10px] font-black uppercase tracking-wider mb-0.5 truncate ${isOwn ? 'text-white/70' : 'text-accent-purple/80'}`}>
                {message.replyTo.username}
              </div>
              <div className="text-[11px] line-clamp-2 break-all overflow-wrap-anywhere opacity-70 leading-normal italic">
                {message.replyTo.content}
              </div>
            </div>
          )}
          <span className="whitespace-pre-wrap break-all overflow-wrap-anywhere font-medium tracking-tight">
            {message.content}
          </span>
          
          {/* Reaction display */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <div key={emoji} className="relative group/rxn">
                  <button
                    onClick={() => reactToMessage(message.id, emoji)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all border
                      ${users.includes(useRoom().user?.username)
                        ? 'bg-accent-purple/20 border-accent-purple/40 text-accent-purple' 
                        : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10'}`}
                  >
                    <span>{emoji}</span>
                    {users.length > 1 && <span>{users.length}</span>}
                  </button>
                  
                  {/* Reactor tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-black/90 text-white text-[9px] rounded whitespace-nowrap opacity-0 group-hover/rxn:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-white/10">
                    {users.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Internal Timestamp & E2EE indicator */}
          <div className={`mt-1.5 flex items-center justify-end gap-1.5 ${isOwn ? 'opacity-70' : 'opacity-40'}`}>
            {message.e2ee && (
              <ShieldCheck className="w-2.5 h-2.5 text-current" title="End-to-end encrypted" />
            )}
            <span className="text-[9px] select-none font-bold tracking-tighter uppercase">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
        </div>

      </div>

      {/* Hover Action / Reaction Bar */}
      {(isHovered || showActions) && (
        <div 
          className={`absolute -top-11 flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-[#1e1e2d] border border-white/10 shadow-2xl z-40 animate-bounce-in min-w-fit
            ${isOwn ? 'right-0 origin-right' : 'left-0 origin-left'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-0.5">
            {REACTION_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  reactToMessage(message.id, emoji);
                  setShowActions(false);
                }}
                className="text-lg hover:scale-125 transition-transform active:scale-150 p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
          
          <div className="w-px h-4 bg-white/10 mx-1" />
          
          <div className="flex items-center gap-0.5 pr-1">
            <button
              onClick={(e) => { e.stopPropagation(); setShowReactionPicker(!showReactionPicker); }}
              className={`p-1.5 rounded-xl text-text-muted hover:text-accent-yellow transition-all ${showReactionPicker ? 'text-accent-yellow bg-white/5' : ''}`}
              title="Add Reaction"
            >
              <SmilePlus className="w-4 h-4" />
            </button>

            {onReply && (
              <button
                onClick={(e) => { e.stopPropagation(); onReply(message); setShowActions(false); }}
                className="p-1.5 rounded-xl text-text-muted hover:text-white hover:bg-white/5 transition-all"
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Extended Reaction Picker */}
      {showReactionPicker && (
        <div 
          className={`absolute -top-24 flex flex-wrap max-w-[200px] gap-1 px-3 py-2 rounded-2xl bg-[#13131f] border border-white/10 shadow-2xl z-50 animate-bounce-in
            ${isOwn ? 'right-0' : 'left-0'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {['😂','💀','🔥','🤡','😢','🙏','💯','✨','🎉'].map(emoji => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                reactToMessage(message.id, emoji);
                setShowReactionPicker(false);
                setShowActions(false);
              }}
              className="text-lg hover:scale-125 transition-transform p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
