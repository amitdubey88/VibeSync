import { useState, useRef, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import MessageBubble from './MessageBubble';
import { Send, Smile } from 'lucide-react';

// Quick emoji sets — no external library needed
const EMOJI_SETS = [
  ['😂','😍','😮','😢','😡','🤔','🥳','😎'],
  ['👍','👎','👏','🙌','🔥','💯','❤️','💜'],
  ['🎉','🍿','👀','🤣','😭','💀','🫶','✨'],
];

const ChatPanel = () => {
  const { messages, sendMessage, sendReaction } = useRoom();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
    setInput('');
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
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-border-dark flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-text-primary">Live Chat</h3>
        <span className="badge bg-accent-red/10 text-accent-red">
          {messages.filter((m) => m.type === 'text').length} messages
        </span>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto scroll-area px-3 py-3 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div className="text-4xl">💬</div>
            <p className="text-text-muted text-sm">No messages yet.<br />Say hello!</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.userId === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Emoji picker ── */}
      {showEmoji && (
        <div className="absolute bottom-20 right-2 z-30 glass rounded-2xl p-3 shadow-2xl w-72 border border-border-light animate-fade-in">
          <div className="mb-2">
            <p className="text-xs text-text-muted mb-2 font-semibold">Add to message</p>
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
          <div className="border-t border-border-dark pt-2">
            <p className="text-xs text-text-muted mb-1.5 font-semibold">React on video</p>
            <div className="flex gap-1">
              {['🔥','❤️','😂','👏','😱','💯','🤩','🎉'].map((e) => (
                <button
                  key={e}
                  className="text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent-purple/20 transition-all hover:scale-125"
                  onClick={() => handleEmojiReaction(e)}
                  title="React on video"
                >{e}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="px-3 py-3 border-t border-border-dark shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
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
            onChange={(e) => setInput(e.target.value)}
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
      </div>
    </div>
  );
};

export default ChatPanel;
