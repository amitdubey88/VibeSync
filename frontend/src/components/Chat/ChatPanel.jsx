import { useState, useRef, useEffect, useCallback } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import MessageBubble from './MessageBubble';
import QuickReactionBar from '../VideoPlayer/QuickReactionBar';
import { Send, Smile, Bell, BellOff, X, ShieldCheck } from 'lucide-react';
import useWebRTC from '../../hooks/useWebRTC';

// Quick emoji sets — no external library needed
const EMOJI_SETS = [
  ['😂','😍','😮','😢','😡','🤔','🥳','😎'],
  ['👍','👎','👏','🙌','🔥','💯','❤️','💜'],
  ['🎉','🍿','👀','🤣','😭','💀','🫶','✨'],
];


const ChatPanel = ({ chatMuted, setChatMuted }) => {
  const { messages, sendMessage, sendReaction, room, typingUsers, broadcastTyping, markChatRead, isHost, isLiveStreamingInitialized, currentVideo } = useRoom();
  const { user } = useAuth();
  const { remotePremierStream } = useWebRTC();
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const isWebRTCStream = currentVideo?.type === 'live';
  const isStreamActive = isLiveStreamingInitialized || (!isHost && remotePremierStream);
  const shouldShowReactions = currentVideo && (!isWebRTCStream || isStreamActive);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showSwipeGuide, setShowSwipeGuide] = useState(
    () => localStorage.getItem('vs_swipe_guide_seen') !== 'true'
  );
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const dismissSwipeGuide = () => {
    localStorage.setItem('vs_swipe_guide_seen', 'true');
    setShowSwipeGuide(false);
  };

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    const resizeHandler = () => setIsMobile(window.innerWidth < 768);
    document.addEventListener('fullscreenchange', fsHandler);
    window.addEventListener('resize', resizeHandler);
    return () => {
      document.removeEventListener('fullscreenchange', fsHandler);
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  // Emit read receipts for all visible messages from others when panel is active
  useEffect(() => {
    if (!room || !messages.length) return;
    const unreadFromOthers = messages
      .filter(m => m.type === 'text' && m.userId !== user?.id && m.username !== user?.username)
      .map(m => m.id);
    if (unreadFromOthers.length) markChatRead(unreadFromOthers);
  // Only run when new messages arrive or user opens the panel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, room?.code]);

  const handleSend = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage(text, replyToMessage);
    setInput('');
    setReplyToMessage(null);
    inputRef.current?.focus();
  };

  const handleEmojiSelect = (emoji) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleEmojiReaction = (emoji) => {
    sendReaction(emoji);
    setShowEmoji(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.01] backdrop-blur-sm">
        <div className="flex flex-col">
          <h3 className="text-[13px] font-black text-text-primary tracking-tighter uppercase mb-0.5">Live Chat</h3>
          <p className="text-[9px] text-text-muted font-bold tracking-widest uppercase opacity-60">Synchronized</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setChatMuted(!chatMuted)}
            className={`p-2 rounded-xl transition-all active:scale-95 ${chatMuted ? 'text-red-400 bg-red-500/10' : 'text-text-muted hover:bg-white/5 hover:text-text-primary'}`}
            title={chatMuted ? "Unmute chat notifications" : "Mute chat notifications"}
          >
            {chatMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto scroll-area px-3 pt-12 pb-3 space-y-1">

        {/* E2EE Security Notice */}
        <div className="flex items-center gap-2.5 py-2.5 px-4 mb-4 bg-accent-yellow/5 border border-accent-yellow/10 rounded-xl justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-yellow/60 shrink-0" />
            <p className="text-[10px] text-accent-yellow/80 font-medium tracking-wide uppercase">
                End-to-end encrypted
            </p>
        </div>

        {/* Swipe-to-reply guide — shown once until user dismisses */}
        {showSwipeGuide && (
          <div className="mb-3 rounded-2xl border border-accent-purple/30 bg-accent-purple/10 backdrop-blur-sm overflow-hidden animate-fade-in">
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👈</span>
                <span className="text-sm font-bold text-text-primary">Swipe to Reply</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Drag any message <span className="font-semibold text-accent-purple">rightward</span> to reply to it — just like WhatsApp!
                A reply icon appears as you swipe, and releases when you let go.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                {/* Animated demo */}
                <div className="flex-1 flex items-center gap-2 bg-bg-hover rounded-xl px-3 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-accent-purple/40 shrink-0" />
                  <div className="flex-1 h-2 rounded-full bg-bg-primary/80" />
                  <span className="text-xs text-accent-purple animate-bounce">→</span>
                </div>
              </div>
            </div>
            <button
              onClick={dismissSwipeGuide}
              className="w-full py-2 text-xs font-bold text-accent-purple hover:bg-accent-purple/20 transition-colors border-t border-accent-purple/20"
            >
              Got it, don't show again ✓
            </button>
          </div>
        )}

        {messages.filter(m => m.type !== 'system').length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-3xl shadow-inner border border-white/5">
              💬
            </div>
            <h4 className="text-sm font-bold text-text-primary mb-1">No messages yet</h4>
            <p className="text-xs text-text-muted leading-relaxed max-w-[180px]">
              Be the first to say something and start the conversation!
            </p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isOwn = msg.userId === user?.id || msg.username === user?.username;
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={isOwn}
              onReply={setReplyToMessage}
              prevMessage={prevMsg}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Typing Indicator (above input bar, WhatsApp-style) ── */}
      {Object.keys(typingUsers).length > 0 && (
        <div className="px-4 py-1.5 flex items-center gap-2 animate-fade-in border-t border-border-dark/30 bg-bg-secondary/60 shrink-0">
          <div className="flex gap-1 h-3 items-center">
            <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-typing-dot-1" />
            <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-typing-dot-2" />
            <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-typing-dot-3" />
          </div>
          <span className="text-[11px] text-accent-purple font-medium italic">
            {Object.keys(typingUsers).length === 1
              ? `${Object.keys(typingUsers)[0]} is typing…`
              : `${Object.keys(typingUsers).length} people are typing…`}
          </span>
        </div>
      )}

      {/* ── Emoji picker ── */}
      {showEmoji && (
        <div className="absolute bottom-20 right-2 z-30 glass rounded-2xl p-3 shadow-2xl w-72 border border-border-light animate-fade-in">
          <div className="mb-2">
            <p className="text-xs text-text-muted mb-2 font-semibold uppercase tracking-wide">Add to message</p>
            {EMOJI_SETS.map((row, i) => (
              <div key={i} className="flex gap-1 mb-1">
                {row.map((e) => (
                  <button
                    key={e}
                    className="text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-all hover:scale-125"
                    onClick={() => handleEmojiSelect(e)}
                  >{e}</button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reactions Bar (Mobile Chat ONLY) */}
      {shouldShowReactions && isMobile && !isFullscreen && (
        <div className="px-4 border-t border-white/5 bg-white/[0.02]">
           <QuickReactionBar isOverlay={false} />
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="flex flex-col border-t border-white/5 shrink-0 bg-white/[0.01] backdrop-blur-md">
        
        {/* Reply Preview */}
        {replyToMessage && (
          <div className="flex items-center justify-between px-4 py-3 bg-accent-purple/5 text-xs border-b border-white/5 animate-slide-up">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-1 h-8 bg-accent-purple rounded-full shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-accent-purple tracking-wider uppercase">Replying to {replyToMessage.username}</span>
                <span className="text-text-muted truncate leading-relaxed italic opacity-80">
                  "{replyToMessage.content.length > 50 
                    ? replyToMessage.content.substring(0, 50) + '...' 
                    : replyToMessage.content}"
                </span>
              </div>
            </div>
            <button 
              onClick={() => setReplyToMessage(null)} 
              className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all active:scale-95"
              title="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        <form onSubmit={handleSend} className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowEmoji((s) => !s)}
            className={`flex items-center justify-center p-2 rounded-xl transition-all active:scale-90 ${showEmoji ? 'text-accent-yellow bg-accent-yellow/10' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
            title="Emoji / Reactions"
          >
            <Smile className="w-5 h-5" />
          </button>

          <div className="relative flex-1 group">
            <input
              ref={inputRef}
              type="text"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-text-primary placeholder:text-text-muted/50 text-[14px] transition-all focus:outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 selection:bg-accent-purple/30"
              placeholder="Send a message…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (e.target.value.trim()) {
                  broadcastTyping();
                }
              }}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-purple text-white shadow-lg shadow-accent-purple/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:hover:scale-100 disabled:shadow-none"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        
      </div>

    </div>
  );
};

export default ChatPanel;
