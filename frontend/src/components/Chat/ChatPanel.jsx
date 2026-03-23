import { useState, useRef, useEffect } from "react";
import { useRoom } from "../../context/RoomContext";
import { useAuth } from "../../context/AuthContext";
import MessageBubble from "./MessageBubble";
import QuickReactionBar from "../VideoPlayer/QuickReactionBar";
import { 
  SendIcon, SmileIcon, BellIcon, BellOffIcon, 
  XIcon, ShieldIcon, PlusIcon, ChatIcon 
} from "../UI/SharpIcons";
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
  const { activePoll, createPoll } = usePolls();
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
  }, [messages, room, user?.id, user?.username, markChatRead]);

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Chat Header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#0a0a0b] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 flex items-center justify-center">
            <ChatIcon size={20} className="text-white" fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-[13px] font-black text-white uppercase tracking-wider font-headline leading-tight">
              Live Chat
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500" />
              <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-[0.15em]">
                Connected
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setChatMuted(!chatMuted)}
          className={`flex items-center gap-2 px-3 py-1.5 transition-all active:scale-95 ${
            chatMuted
              ? "bg-red-500/10 text-red-500 border border-red-500/20"
              : "bg-white/10 text-white border border-white/10 hover:bg-white/15"
          }`}
        >
          {chatMuted ? (
            <BellOffIcon size={14} fill="currentColor" />
          ) : (
            <BellIcon size={14} fill="currentColor" />
          )}
          <span className="text-[10px] font-black uppercase tracking-widest">
            {chatMuted ? "Muted" : "Active"}
          </span>
        </button>
      </div>

      {/* ── Pinned Alerts & Active Polls (Non-scrolling) ── */}
      {(pinnedMessage || activePoll) && (
        <div className="shrink-0 bg-black/60 backdrop-blur-xl border-b border-white/5 flex flex-col z-20 overflow-hidden relative">
          {/* Subtle Glow behind pinned content */}
          <div className="absolute inset-0 bg-gradient-to-b from-accent-purple/5 to-transparent pointer-events-none" />

          <PinnedMessageBanner
            pinnedMessage={pinnedMessage}
            onUnpin={unpinMessage}
          />

          {activePoll && (
            <button
              onClick={scrollToPoll}
              className="flex items-center gap-2 px-4 py-1.5 bg-fuchsia-500/5 border-t border-white/5 group/poll-pin relative z-10 hover:bg-fuchsia-500/10 active:scale-[0.99] transition-all text-left w-full"
            >
              <div className="w-1 h-1  bg-fuchsia-500 animate-pulse shrink-0" />
              <span className="text-[9px] font-black text-fuchsia-400/80 uppercase tracking-[0.2em] shrink-0">
                Poll Active:
              </span>
              <span className="text-[11px] text-white/50 truncate font-medium flex-1 group-hover/poll-pin:text-white/80 transition-colors uppercase tracking-tight">
                {activePoll.question}
              </span>
              <span className="text-[9px] font-bold text-fuchsia-500/40 opacity-0 group-hover/poll-pin:opacity-100 transition-opacity">
                Tap to Jump
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto scroll-area px-3 pt-3 pb-3 space-y-1">
        {/* E2EE Security Notice */}
        <div className="flex items-center gap-2.5 py-2 px-3 mb-3 bg-gradient-to-r from-obsidian-primary/10 to-obsidian-tertiary/8 border border-obsidian-primary/20 mx-auto w-fit rounded-lg shadow-[0_0_12px_rgba(170,85,255,0.08)]">
          <ShieldIcon size={12} className="text-obsidian-primary/60 shrink-0" fill="currentColor" />
          <p className="text-[9px] text-obsidian-primary/70 font-semibold tracking-wider uppercase">
            End-to-end encrypted
          </p>
        </div>

        {/* Swipe-to-reply guide — shown once until user dismisses */}
        {showSwipeGuide && (
          <div className="mb-3 border border-obsidian-primary/30 bg-gradient-to-r from-obsidian-primary/12 to-obsidian-primary/6 backdrop-blur-md overflow-hidden animate-fade-in rounded-lg">
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">👈</span>
                <span className="text-sm font-bold text-obsidian-on-surface">
                  Swipe to Reply
                </span>
              </div>
              <p className="text-xs text-obsidian-on-surface-variant leading-relaxed">
              Drag any message{" "}
                <span className="font-semibold text-obsidian-primary">
                  rightward
                </span>{" "}
                to reply to it — A reply icon appears as you swipe, and releases
                when you let go.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                {/* Animated demo */}
                <div className="flex-1 flex items-center gap-2 bg-obsidian-primary/8  px-3 py-1.5 rounded-lg border border-obsidian-primary/15">
                  <div className="w-5 h-5 rounded-md bg-obsidian-primary/40 shrink-0" />
                  <div className="flex-1 h-2 rounded-full bg-obsidian-primary/12" />
                  <span className="text-xs text-obsidian-primary animate-bounce">
                    →
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={dismissSwipeGuide}
              className="w-full py-2 text-xs font-bold text-obsidian-primary hover:bg-obsidian-primary/15 transition-colors border-t border-obsidian-primary/15"
            >
              Got it, don't show again ✓
            </button>
          </div>
        )}

        {messages.filter((m) => m.type !== "system").length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center animate-fade-in">
            <div className="w-16 h-16 bg-gradient-to-br from-obsidian-primary/15 to-obsidian-primary/8 flex items-center justify-center mb-4 text-3xl shadow-[0_0_15px_rgba(170,85,255,0.1)] border border-obsidian-primary/20 rounded-2xl">
              💬
            </div>
            <h4 className="text-sm font-bold text-obsidian-on-surface mb-1">
              No messages yet
            </h4>
            <p className="text-xs text-obsidian-on-surface-variant leading-relaxed max-w-[180px]">
              Be the first to say something and start the conversation!
            </p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isOwn =
            msg.userId === user?.id || msg.username === user?.username;
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
          
          // A message is the "last in group" if:
          // 1. It's the very last message in the array
          // 2. The next message is from a different sender
          // 3. The next message is a system message
          // 4. The next message was sent more than 5 minutes later
          const isLastInGroup = !nextMsg || 
            nextMsg.type === "system" ||
            nextMsg.userId !== msg.userId || 
            (new Date(nextMsg.createdAt) - new Date(msg.createdAt)) > 5 * 60 * 1000;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={isOwn}
              onReply={setReplyToMessage}
              onPin={pinMessage}
              prevMessage={prevMsg}
              isLastInGroup={isLastInGroup}
              isHost={isHost}
              isCoHost={isCoHost}
            />
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Typing Indicator ── */}
      {Object.keys(typingUsers).length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2.5 animate-fade-in border-t border-obsidian-primary/15 bg-gradient-to-r from-obsidian-primary/10 to-transparent shrink-0">
          <div className="flex gap-[3px] items-center">
            <span className="w-1.5 h-1.5 bg-obsidian-primary/70 rounded-full animate-typing-dot-1" />
            <span className="w-1.5 h-1.5 bg-obsidian-primary/70 rounded-full animate-typing-dot-2" />
            <span className="w-1.5 h-1.5 bg-obsidian-primary rounded-full animate-typing-dot-3" />
          </div>
          <span className="text-[10px] text-obsidian-primary/80 font-semibold tracking-wide uppercase">
            {Object.keys(typingUsers).length === 1
              ? `${Object.keys(typingUsers)[0]} is typing`
              : `${Object.keys(typingUsers).length} people typing`}
          </span>
        </div>
      )}

      {/* ── Emoji picker ── */}
      {showEmoji && (
        <div className="absolute bottom-20 right-2 z-30 glass-panel p-4 shadow-[0_20px_60px_rgba(0,0,0,0.4)] w-[320px] animate-fade-in rounded-2xl border border-obsidian-primary/25">
          <div className="mb-3">
            <p className="text-xs text-obsidian-on-surface-variant mb-2 font-semibold uppercase tracking-wider text-center">
              Add to message
            </p>
            {EMOJI_SETS.map((row, i) => (
              <div key={i} className="grid grid-cols-8 gap-1 mb-2">
                {row.map((e) => (
                  <button
                    key={e}
                    className="text-xl w-8 h-8 flex items-center justify-center hover:bg-obsidian-primary/15 transition-all cubic-bezier(0.22,1,0.36,1) hover:scale-130 active:scale-90 rounded-lg"
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
          <div className="flex items-center justify-between px-4 py-3 bg-fuchsia-500/5 text-xs border-b border-white/5 animate-slide-up">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-1 h-8 bg-fuchsia-500  shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-fuchsia-400 tracking-wider uppercase">
                  Replying to <b className="font-bold">{replyToMessage.username}</b>
                </span>
                <span className="text-zinc-500 truncate leading-relaxed italic opacity-80">
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
              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10  transition-all active:scale-95"
              title="Cancel reply"
            >
              <XIcon size={16} />
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
              className={`flex items-center justify-center p-2  transition-all active:scale-90 ${showAttachMenu ? "text-fuchsia-400 bg-fuchsia-500/10" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
              title="Attach"
            >
              <PlusIcon
                size={20}
                className={`transition-transform duration-200 ${showAttachMenu ? "rotate-45" : ""}`}
              />
            </button>

            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 py-2 w-48 bg-[#0a0a0b]/95 backdrop-blur-3xl border border-white/5  shadow-2xl z-50 animate-slide-up origin-bottom-left">
                {canCreatePoll && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPollModal(true);
                      setShowAttachMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors text-left"
                  >
                    <svg
                      className="w-4 h-4 text-fuchsia-400"
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
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors text-left"
                >
                  <span className="text-[10px] font-black border-2 border-emerald-400 text-emerald-400 px-1 uppercase tracking-wider flex items-center justify-center w-5 h-5 shrink-0">
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
            className={`flex items-center justify-center p-2  transition-all active:scale-90 ${showEmoji ? "text-amber-400 bg-amber-500/10" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
            title="Emoji / Reactions"
          >
            <SmileIcon size={20} />
          </button>

          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              className="w-full px-1 py-2.5 bg-transparent border-0 border-b border-white/5 text-white placeholder:text-white/20 text-[13px] font-medium transition-all focus:outline-none focus:border-obsidian-primary selection:bg-obsidian-primary/30"
              placeholder="Sync your vibe..."
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
              className="flex items-center justify-center w-10 h-10 bg-obsidian-primary text-white shadow-[0_0_20px_rgba(189,157,255,0.3)] transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:grayscale disabled:shadow-none relative z-20"
              title="Send"
            >
              <SendIcon size={16} fill="currentColor" />
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
