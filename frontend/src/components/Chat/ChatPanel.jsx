import { useState, useRef, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import MessageBubble from './MessageBubble';
import { Send, Smile, Bell, BellOff, X, Reply, ShieldCheck } from 'lucide-react';

// Quick emoji sets — no external library needed
const EMOJI_SETS = [
  ['😂','😍','😮','😢','😡','🤔','🥳','😎'],
  ['👍','👎','👏','🙌','🔥','💯','❤️','💜'],
  ['🎉','🍿','👀','🤣','😭','💀','🫶','✨'],
];


const ChatPanel = ({ chatMuted, setChatMuted }) => {
  const { messages, sendMessage, sendReaction, room, currentVideo, typingUsers, broadcastTyping } = useRoom();
  const { user } = useAuth();
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
      <div className="px-4 py-3 border-b border-border-dark flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-text-primary">Live Chat</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setChatMuted(!chatMuted)}
            className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title={chatMuted ? "Unmute chat notifications" : "Mute chat notifications"}
          >
            {chatMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>
          <span className="badge bg-accent-red/10 text-accent-red">
            {messages.filter((m) => m.type === 'text').length} messages
          </span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto scroll-area px-3 py-3 space-y-1">

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
        {messages.map((msg) => {
          const isOwn = msg.userId === user?.id || msg.username === user?.username;
          return <MessageBubble key={msg.id} message={msg} isOwn={isOwn} onReply={setReplyToMessage} />;
        })}
        <div ref={bottomRef} />
      </div>

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

      {/* ── Input bar ── */}
      <div className="flex flex-col border-t border-border-dark shrink-0">
        
        {/* Reply Preview */}
        {replyToMessage && (
          <div className="flex items-center justify-between px-3 py-2 bg-bg-hover text-xs border-b border-border-dark">
            <div className="flex items-center gap-2 overflow-hidden">
              <Reply className="w-3.5 h-3.5 text-accent-purple shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-accent-purple truncate">Replying to {replyToMessage.username}</span>
                <span className="text-text-muted truncate">
                  {replyToMessage.content.length > 50 
                    ? replyToMessage.content.substring(0, 50) + '...' 
                    : replyToMessage.content}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setReplyToMessage(null)} 
              className="p-1 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded shrink-0"
              title="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowEmoji((s) => !s)}
            className="btn-icon text-text-secondary hover:text-accent-yellow shrink-0"
            title="Emoji / Reactions"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            ref={inputRef}
            type="text"
            className="input flex-1 py-2 text-sm"
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
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-primary px-3 py-2 h-9 shrink-0"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        
        {/* Typing Indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="px-4 py-1.5 flex items-center gap-2 animate-fade-in bg-white/5 border-t border-border-dark/30">
            <div className="flex gap-1 h-3 items-center">
              <span className="w-1 h-1 bg-accent-purple rounded-full animate-typing-dot-1" />
              <span className="w-1 h-1 bg-accent-purple rounded-full animate-typing-dot-2" />
              <span className="w-1 h-1 bg-accent-purple rounded-full animate-typing-dot-3" />
            </div>
            <span className="text-[10px] text-accent-purple font-medium italic">
              {Object.keys(typingUsers).length === 1 
                ? `${Object.keys(typingUsers)[0]} is typing...`
                : `${Object.keys(typingUsers).length} people are typing...`}
            </span>
          </div>
        )}
      </div>

    </div>
  );
};

export default ChatPanel;
