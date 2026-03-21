import { useState, useRef, useEffect, useCallback } from "react";
import { useRoom } from "../../context/RoomContext";
import { useAuth } from "../../context/AuthContext";
import MessageBubble from "./MessageBubble";
import QuickReactionBar from "../VideoPlayer/QuickReactionBar";
import { Send, Smile, Bell, BellOff, X, ShieldCheck, Plus, MessageSquare } from "lucide-react";
import useWebRTC from "../../hooks/useWebRTC";
import { useSocket } from "../../context/SocketContext";
import { usePinnedMessage } from "../../hooks/usePinnedMessage";
import { usePolls } from "../../hooks/usePolls";
import { useSlowMode } from "../../hooks/useSlowMode";
import { useCoHost } from "../../hooks/useCoHost";
import PinnedMessageBanner from "./PinnedMessageBanner";
import PollBubble from "./PollBubble";
import CreatePollModal from "./CreatePollModal";
import GifPicker from "./GifPicker";
import SlowModeTimer from "./SlowModeTimer";

// Quick emoji sets — no external library needed
const EMOJI_SETS = [
  ["😂", "😍", "😮", "😢", "😡", "🤔", "🥳", "😎"],
  ["👍", "👎", "👏", "🙌", "🔥", "💯", "❤️", "💜"],
  ["🎉", "🍿", "👀", "🤣", "😭", "💀", "🫶", "✨"],
];

const ChatPanel = ({ chatMuted, setChatMuted }) => {
  const {
    messages,
    sendMessage,
    sendReaction,
    room,
    typingUsers,
    broadcastTyping,
    markChatRead,
    isHost,
    isLiveStreamingInitialized,
    currentVideo,
  } = useRoom();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { remotePremierStream } = useWebRTC();
  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement,
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const isWebRTCStream = currentVideo?.type === "live";
  const isStreamActive =
    isLiveStreamingInitialized || (!isHost && remotePremierStream);
  const shouldShowReactions =
    currentVideo && (!isWebRTCStream || isStreamActive);
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showSwipeGuide, setShowSwipeGuide] = useState(
    () => localStorage.getItem("vs_swipe_guide_seen") !== "true",
  );
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  // Feature Hooks
  const { pinnedMessage, pinMessage, unpinMessage } = usePinnedMessage();
  const { activePoll, createPoll, votePoll, endPoll } = usePolls();
  const { isSlowMode, remainingCooldown } = useSlowMode();
  const { isCoHost } = useCoHost();
  
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const canCreatePoll = isHost || isCoHost;

  const scrollToPoll = () => {
    if (activePoll?.messageId) {
      const el = document.getElementById(`msg-${activePoll.messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("animate-pulse-purple-ring");
        setTimeout(() => el.classList.remove("animate-pulse-purple-ring"), 2000);
      }
    }
  };

  const dismissSwipeGuide = () => {
    localStorage.setItem("vs_swipe_guide_seen", "true");
    setShowSwipeGuide(false);
  };

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    const resizeHandler = () => setIsMobile(window.innerWidth < 768);
    const clickHandler = (e) => {
      // Close attach menu if clicking outside
      if (!e.target.closest('.attach-menu-container')) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("fullscreenchange", fsHandler);
    window.addEventListener("resize", resizeHandler);
    document.addEventListener("mousedown", clickHandler);
    return () => {
      document.removeEventListener("fullscreenchange", fsHandler);
      window.removeEventListener("resize", resizeHandler);
      document.removeEventListener("mousedown", clickHandler);
    };
  }, []);

  // Emit read receipts for all visible messages from others when panel is active
  useEffect(() => {
    if (!room || !messages.length) return;
    const unreadFromOthers = messages
      .filter(
        (m) =>
          m.type === "text" &&
          m.userId !== user?.id &&
          m.username !== user?.username,
      )
      .map((m) => m.id);
    if (unreadFromOthers.length) markChatRead(unreadFromOthers);
    // Only run when new messages arrive or user opens the panel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, room?.code]);

  const handleSend = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage(text, replyToMessage);
    setInput("");
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Chat Header ── */}
      <div className="flex items-center justify-between px-3 py-1.5 md:px-5 md:py-3 border-b border-white/5 bg-white/[0.03] backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent-purple/15 flex items-center justify-center border border-accent-purple/20">
            <MessageSquare className="w-4 h-4 text-accent-purple" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-text-primary tracking-tight">
              Live Chat
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                Connected
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setChatMuted(!chatMuted)}
          className={`group flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full transition-all active:scale-95 border ${
            chatMuted
              ? "text-red-400 bg-red-500/10 border-red-500/30 ring-4 ring-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
              : "text-text-muted bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 hover:text-text-primary shadow-inner"
          }`}
          title={
            chatMuted ? "Unmute chat notifications" : "Mute chat notifications"
          }
        >
          <div
            className={`p-1 rounded-full transition-colors ${chatMuted ? "bg-red-500/20" : "bg-white/10 group-hover:bg-accent-purple/20"}`}
          >
            {chatMuted ? (
              <BellOff className="w-3 h-3" />
            ) : (
              <Bell
                className={`w-3 h-3 transition-colors ${chatMuted ? "" : "group-hover:text-accent-purple"}`}
              />
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {chatMuted ? "Muted" : "Active"}
          </span>
        </button>
      </div>

      {/* ── Pinned Alerts & Active Polls (Non-scrolling) ── */}
      {(pinnedMessage || activePoll) && (
        <div className="shrink-0 bg-[#16161D]/60 border-b border-white/5 flex flex-col z-20 overflow-hidden relative">
          {/* Subtle Glow behind pinned content */}
          <div className="absolute inset-0 bg-gradient-to-b from-accent-purple/5 to-transparent pointer-events-none" />

          <PinnedMessageBanner
            pinnedMessage={pinnedMessage}
            onUnpin={unpinMessage}
          />

          {activePoll && (
            <button
              onClick={scrollToPoll}
              className="flex items-center gap-2 px-4 py-1.5 bg-accent-purple/5 border-t border-white/5 group/poll-pin relative z-10 hover:bg-accent-purple/10 active:scale-[0.99] transition-all text-left w-full"
            >
              <div className="w-1 h-1 rounded-full bg-accent-purple animate-pulse shrink-0" />
              <span className="text-[9px] font-black text-accent-purple/80 uppercase tracking-[0.2em] shrink-0">
                Poll Active:
              </span>
              <span className="text-[11px] text-white/50 truncate font-medium flex-1 group-hover/poll-pin:text-white/80 transition-colors uppercase tracking-tight">
                {activePoll.question}
              </span>
              <span className="text-[9px] font-bold text-accent-purple/40 opacity-0 group-hover/poll-pin:opacity-100 transition-opacity">
                Tap to Jump
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto scroll-area px-3 pt-3 pb-3 space-y-1">
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
                <span className="text-sm font-bold text-text-primary">
                  Swipe to Reply
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Drag any message{" "}
                <span className="font-semibold text-accent-purple">
                  rightward
                </span>{" "}
                to reply to it — A reply icon appears as you swipe, and releases
                when you let go.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                {/* Animated demo */}
                <div className="flex-1 flex items-center gap-2 bg-bg-hover rounded-xl px-3 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-accent-purple/40 shrink-0" />
                  <div className="flex-1 h-2 rounded-full bg-bg-primary/80" />
                  <span className="text-xs text-accent-purple animate-bounce">
                    →
                  </span>
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

        {messages.filter((m) => m.type !== "system").length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-3xl shadow-inner border border-white/5">
              💬
            </div>
            <h4 className="text-sm font-bold text-text-primary mb-1">
              No messages yet
            </h4>
            <p className="text-xs text-text-muted leading-relaxed max-w-[180px]">
              Be the first to say something and start the conversation!
            </p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isOwn =
            msg.userId === user?.id || msg.username === user?.username;
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={isOwn}
              onReply={setReplyToMessage}
              onPin={pinMessage}
              prevMessage={prevMsg}
              isHost={isHost}
              isCoHost={isCoHost}
            />
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Typing Indicator ── */}
      {Object.keys(typingUsers).length > 0 && (
        <div className="px-4 py-1.5 flex items-center gap-2.5 animate-fade-in border-t border-white/5 bg-gradient-to-r from-accent-purple/5 to-transparent shrink-0">
          <div className="flex gap-[3px] items-center">
            <span className="w-1 h-1 bg-accent-purple/70 rounded-full animate-typing-dot-1" />
            <span className="w-1 h-1 bg-accent-purple/70 rounded-full animate-typing-dot-2" />
            <span className="w-1 h-1 bg-accent-purple rounded-full animate-typing-dot-3" />
          </div>
          <span className="text-[10px] text-accent-purple/80 font-semibold tracking-wide uppercase">
            {Object.keys(typingUsers).length === 1
              ? `${Object.keys(typingUsers)[0]} is typing`
              : `${Object.keys(typingUsers).length} people typing`}
          </span>
        </div>
      )}

      {/* ── Emoji picker ── */}
      {showEmoji && (
        <div className="absolute bottom-20 right-2 z-30 glass rounded-2xl p-3 shadow-2xl w-72 border border-border-light animate-fade-in">
          <div className="mb-2">
            <p className="text-xs text-text-muted mb-2 font-semibold uppercase tracking-wide">
              Add to message
            </p>
            {EMOJI_SETS.map((row, i) => (
              <div key={i} className="flex gap-1 mb-1">
                {row.map((e) => (
                  <button
                    key={e}
                    className="text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-all hover:scale-125"
                    onClick={() => handleEmojiSelect(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reactions Bar (Mobile Chat ONLY) */}
      {shouldShowReactions && isMobile && !isFullscreen && (
        <div className="px-3 py-0.5 border-t border-white/5 bg-white/[0.02]">
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
                <span className="text-[10px] font-black text-accent-purple tracking-wider uppercase">
                  Replying to {replyToMessage.username}
                </span>
                <span className="text-text-muted truncate leading-relaxed italic opacity-80">
                  "
                  {replyToMessage.content.length > 50
                    ? replyToMessage.content.substring(0, 50) + "..."
                    : replyToMessage.content}
                  "
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

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 px-2 py-1.5 md:px-4 md:py-3"
        >
          <div className="relative attach-menu-container flex items-center">
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(!showAttachMenu);
                setShowEmoji(false);
              }}
              className={`flex items-center justify-center p-2 rounded-xl transition-all active:scale-90 ${showAttachMenu ? "text-accent-purple bg-accent-purple/10" : "text-text-secondary hover:text-text-primary hover:bg-white/5"}`}
              title="Attach"
            >
              <Plus
                className={`w-5 h-5 transition-transform duration-200 ${showAttachMenu ? "rotate-45" : ""}`}
              />
            </button>

            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 py-2 w-48 bg-bg-card border border-border-dark rounded-xl shadow-2xl z-50 animate-slide-up origin-bottom-left">
                {canCreatePoll && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPollModal(true);
                      setShowAttachMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-left"
                  >
                    <svg
                      className="w-4 h-4 text-accent-purple"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Create a Poll
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowGif(true);
                    setShowAttachMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-left"
                >
                  <span className="text-[10px] font-black border-2 border-accent-green text-accent-green px-1 rounded uppercase tracking-wider flex items-center justify-center w-5 h-5 shrink-0">
                    G
                  </span>
                  Search Tenor GIF
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowEmoji((s) => !s);
              setShowGif(false);
            }}
            className={`flex items-center justify-center p-2 rounded-xl transition-all active:scale-90 ${showEmoji ? "text-accent-yellow bg-accent-yellow/10" : "text-text-secondary hover:text-text-primary hover:bg-white/5"}`}
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
          <div className="relative">
            {isSlowMode && (
              <SlowModeTimer remaining={remainingCooldown} isHost={isHost} />
            )}
            <button
              type="submit"
              disabled={!input.trim() || (isSlowMode && remainingCooldown > 0)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-purple text-white shadow-lg shadow-accent-purple/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:hover:scale-100 disabled:shadow-none relative z-20"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      <CreatePollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onSubmit={createPoll}
      />

      <GifPicker
        isOpen={showGif}
        onClose={() => setShowGif(false)}
        onSelect={(url, title) => {
          if (socket && room?.code) {
            socket.emit("chat:send-gif", {
              roomCode: room.code,
              gifUrl: url,
              gifTitle: title,
            });
          }
          setShowGif(false);
        }}
      />
    </div>
  );
};

export default ChatPanel;
