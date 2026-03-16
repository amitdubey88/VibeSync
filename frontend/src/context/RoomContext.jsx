import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { getRoomMessages } from '../services/api';
import toast from 'react-hot-toast';
import { deriveKey, encryptData, decryptData } from '../utils/crypto';

// Enhanced sound generator for premium UI feedback
const playUISound = (type = 'message') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (type === 'message') {
      // Soft, high-pitched "ding"
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'social') {
      // Mellow, mid-range "pop" (joins/leaves)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'action') {
      // Very short "tick" (clicks)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {
    // Ignore audio context issues
  }
};

const RoomContext = createContext(null);

export const RoomProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [roomKey, setRoomKey] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [videoState, setVideoState] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isHost, setIsHost] = useState(false);
  // Keep isHostRef in sync so stale socket closures always read the correct value
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  const [reactions, setReactions] = useState([]);
  const [isMutedByHost, setIsMutedByHost] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinStatus, setJoinStatus] = useState('joined');
  // roomEndedByHost: set when host deletes the room, shows a persistent modal
  const [roomEndedByHost, setRoomEndedByHost] = useState(null); // null | { message }
  const [typingUsers, setTypingUsers] = useState({}); // { username: timestamp }

  // Chat notifications state
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatMuted, setChatMuted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [energy, setEnergy] = useState(0); // 0-100 social energy
  const [clips, setClips] = useState([]); // List of timestamp highlights
  const [hostAway, setHostAway] = useState(false); // true when host temporarily disconnects
  const participantsRef = useRef([]);
  // Always-current ref for isHost so socket closures don't go stale (BUG-7)
  const isHostRef = useRef(false);

  const addSystemMessage = useCallback((content) => {
    const sysMsg = {
      id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'system',
      userId: 'system',
      username: 'System',
      content,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, sysMsg]);
    playUISound('social');
  }, []);

  // Derive key when room code changes
  useEffect(() => {
    if (room?.code) {
      deriveKey(room.code).then(setRoomKey);
    } else {
      setRoomKey(null);
    }
  }, [room?.code]);

  const joinRoom = useCallback(async (roomCode) => {
    if (!socket) return;
    socket.emit('room:join', { roomCode });
    
    // Derive key early for history decryption
    const key = await deriveKey(roomCode);
    setRoomKey(key);

    try {
      const { messages: history } = await getRoomMessages(roomCode);
      // Decrypt history if encrypted (heuristic: content is an object or base64)
      const decryptedHistory = await Promise.all((history || []).map(async (m) => {
        let content = m.content;
        if (m.type === 'text' && typeof m.content === 'string' && m.content.length > 20) {
           content = await decryptData(m.content, key);
        }
        
        // Decrypt replyTo content if exists
        let replyTo = m.replyTo;
        if (replyTo && replyTo.content && typeof replyTo.content === 'string' && replyTo.content.length > 20) {
          const decryptedReplyContent = await decryptData(replyTo.content, key);
          replyTo = { ...replyTo, content: decryptedReplyContent };
        }

        return { ...m, content, replyTo };
      }));
      setMessages(decryptedHistory);
    } catch (_) {}
  }, [socket]);

  const leaveRoom = useCallback((explicit = false) => {
    if (!socket || !room) return;
    socket.emit('room:leave', { explicit });
    
    if (explicit) {
      sessionStorage.removeItem('vibesync_session');
    }
    
    setRoom(null);
    setRoomKey(null);
    setParticipants([]);
    setMessages([]);
    setVideoState(null);
    setCurrentVideo(null);
    setIsHost(false);
    setVoiceParticipants([]);
    setIsMutedByHost(false);
    setTypingUsers({});
  }, [socket, room]);

  // ── Smooth Video Time Stepping ──────────────────────────────────────────────
  // Participants use this for progression when watching a broadcast/live stream
  useEffect(() => {
    if (!videoState || !videoState.isPlaying) return;

    const interval = setInterval(() => {
      setVideoState((prev) => {
        if (!prev || !prev.isPlaying) return prev;
        return { ...prev, currentTime: prev.currentTime + 0.1 };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [videoState?.isPlaying, videoState?.lastUpdated]); // Re-sync on pause/play or hard seek

  // ── Socket event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onRoomState = async ({ room: r }) => {
      setRoom(r);
      setParticipants(r.participants || []);
      const activeVoice = (r.voiceParticipants || []).filter(p => !p.isPassive);
      setVoiceParticipants(activeVoice);
      setVideoState(r.videoState);
      
      // Decrypt video source if needed
      if (r.currentVideo && r.currentVideo.e2ee) {
        const key = await deriveKey(r.code);
        const decryptedUrl = await decryptData(r.currentVideo.url, key);
        const decryptedTitle = await decryptData(r.currentVideo.title, key);
        setCurrentVideo({ ...r.currentVideo, url: decryptedUrl, title: decryptedTitle });
      } else {
        setCurrentVideo(r.currentVideo);
      }
      
      setIsHost(r.hostId === user?.id);
      setRequiresApproval(r.requiresApproval || false);
      setIsLocked(r.isLocked || false);
      setJoinStatus('joined'); // receiving full state means we're in
    };

    const onParticipantUpdate = ({ participants: pts }) => {
      const prev = participantsRef.current;
      const current = pts || [];
      
      // Detect joins
      current.forEach(p => {
        if (!prev.find(old => old.userId === p.userId) && p.userId !== user?.id) {
          addSystemMessage(`${p.username} joined the room`);
        }
      });
      
      // Detect leaves
      prev.forEach(p => {
        if (!current.find(curr => curr.userId === p.userId)) {
          addSystemMessage(`${p.username} left the room`);
        }
      });
      
      participantsRef.current = current;
      setParticipants(current);
    };
    const onVoiceUpdate = ({ voiceParticipants: vp }) => {
      const active = (vp || []).filter(p => !p.isPassive);
      setVoiceParticipants(active);
    };

    const onHostChanged = ({ newHostId, newHostUsername }) => {
      setIsHost(newHostId === user?.id);
      setRoom((prev) => prev ? { ...prev, hostId: newHostId } : prev);
      
      if (newHostId === user?.id) {
        toast.success('👑 You are now the host!');
        addSystemMessage(`You are now the room host`);
      } else {
        addSystemMessage(`${newHostUsername} is now the room host`);
      }
    };

    const onChatMessage = async (msg) => {
      let displayContent = msg.content;
      if (msg.e2ee && roomKey) {
        displayContent = await decryptData(msg.content, roomKey);
      }
      
      let replyTo = msg.replyTo;
      if (replyTo && msg.e2ee && roomKey && replyTo.content) {
        const decryptedReplyContent = await decryptData(replyTo.content, roomKey);
        replyTo = { ...replyTo, content: decryptedReplyContent };
      }

      const decryptedMsg = { ...msg, content: displayContent, replyTo };
      setMessages((prev) => [...prev, decryptedMsg]);
      
      // If it's not my message, check if we need to notify
      if (msg.userId !== user?.id && msg.username !== user?.username) {
        setUnreadChatCount((prev) => prev + 1);
        
        setChatMuted((isMuted) => {
          if (!isMuted) {
            playUISound('message');
            setEnergy(prev => Math.min(prev + 10, 100)); // Boost energy
            toast(`💬 ${msg.username}: ${displayContent.length > 30 ? displayContent.substring(0, 30) + '...' : displayContent}`, {
              duration: 2000,
              icon: '📩',
              id: `chat-${msg.id}`
            });
          }
          return isMuted;
        });
      }
    };

    const onSourceChanged = async ({ video, videoState: vs }) => {
      let displayVideo = video;
      if (video?.e2ee) {
        // BUGFIX: roomKey may still be null when the first video:source-changed event
        // arrives (deriveKey is async and can take 200-500 ms). Using the stale null
        // key causes decryptData to throw, leaving participants with an encrypted blob
        // as their video URL → no video visible. Derive on-demand if not yet ready,
        // mirroring the same defensive pattern in setVideoSource().
        const key = roomKey || (await deriveKey(room?.code));
        if (key) {
          const decryptedUrl = await decryptData(video.url, key);
          const decryptedTitle = await decryptData(video.title, key);
          displayVideo = { ...video, url: decryptedUrl, title: decryptedTitle };
        }
      }
      setCurrentVideo(displayVideo);
      setVideoState(vs);
    };

    // ── host started background upload ──────────────────────────────────────
    const onUploading = ({ title }) => {
      setCurrentVideo({ type: 'uploading', title, url: null });
    };

    const onReaction = async (reaction) => {
      let displayEmoji = reaction.emoji;
      if (reaction.e2ee && roomKey) {
        displayEmoji = await decryptData(reaction.emoji, roomKey);
      }
      
      const id = reaction.id;
      setReactions((prev) => [...prev, { ...reaction, emoji: displayEmoji, id }]);
      setEnergy(prev => Math.min(prev + 5, 100)); // Small boost for reactions
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3500);
    };

    const onRoomDeleted = ({ message }) => {
      // Use the ref so we always read the CURRENT value, not a stale closure (BUG-7)
      if (isHostRef.current) {
        sessionStorage.removeItem("vibesync_session");
        setRoom(null); setParticipants([]); setMessages([]);
        setVideoState(null); setCurrentVideo(null); setIsHost(false);
        window.location.href = '/';
        return;
      }

      setRoomEndedByHost({ message: message || 'The host has ended this session.' });
      setRoom(null); setParticipants([]); setMessages([]);
      setVideoState(null); setCurrentVideo(null); setIsHost(false);
    };

    const onKicked = ({ message }) => {
      toast.error(message || 'You were removed from the room.', { duration: 2000 });
      setRoom(null); setParticipants([]); setMessages([]);
      setVideoState(null); setCurrentVideo(null); setIsHost(false);
      setTimeout(() => {
        window.history.replaceState(null, '', '/');
        window.location.href = '/';
      }, 800);
    };

    const onMuted = () => {
      setIsMutedByHost(true);
      toast('🔇 You were muted by the host', { duration: 2000 });
    };

    const onJoinRequest = (req) => {
      setJoinRequests((prev) => {
        if (prev.find((r) => r.userId === req.userId)) return prev;
        return [...prev, req];
      });
    };
    const onJoinPending = () => setJoinStatus('pending');
    const onJoinDenied = ({ message }) => {
      setJoinStatus('denied');
      toast.error(message || 'Your join request was declined.', { duration: 2000 });
      setTimeout(() => { window.location.href = '/'; }, 2000);
    };
    const onApprovalChanged = ({ requiresApproval: ra }) => setRequiresApproval(ra);
    
    const onLockChanged = ({ isLocked: locked }) => {
      setIsLocked(locked);
      if (locked) toast('The room has been locked by the host.', { icon: '🔒', duration: 2000 });
      else toast('The room is now unlocked.', { icon: '🔓', duration: 2000 });
    };

    // ── Host away/back events (BUG-13) ───────────────────────────────────────
    const onHostAway = ({ message }) => {
      setHostAway(true);
      toast(message || 'Host disconnected…', { icon: '⚠️', duration: 4000 });
    };
    const onHostBack = ({ message }) => {
      setHostAway(false);
      toast.success(message || 'Host reconnected!', { duration: 2000 });
    };
    const onHostLeft = ({ message }) => {
      setHostAway(false);
      toast(message || 'The host has left.', { icon: '👑', duration: 5000 });
    };

    const onTyping = ({ username, timestamp }) => {
      setTypingUsers(prev => ({
        ...prev,
        [username]: timestamp
      }));
    };

    const onMessageReaction = async ({ messageId, emoji, username, e2ee }) => {
      let displayEmoji = emoji;
      if (e2ee && roomKey) {
        try { displayEmoji = await decryptData(emoji, roomKey); } catch (_) {}
      }

      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const reactions = m.reactions || {};
          const users = reactions[displayEmoji] || [];
          
          if (users.includes(username)) {
            // Remove reaction if already present (toggle)
            const nextUsers = users.filter(u => u !== username);
            const nextReactions = { ...reactions };
            if (nextUsers.length === 0) delete nextReactions[displayEmoji];
            else nextReactions[displayEmoji] = nextUsers;
            return { ...m, reactions: nextReactions };
          } else {
            // Add reaction
            const nextReactions = { ...reactions, [displayEmoji]: [...users, username] };
            return { ...m, reactions: nextReactions };
          }
        }
        return m;
      }));
    };

    const onRemotePlay = ({ currentTime }) => {
      if (!isHost) {
        addSystemMessage(`Host resumed the video`);
      }
    };
    const onRemotePause = ({ currentTime }) => {
      if (!isHost) {
        addSystemMessage(`Host paused the video`);
      }
    };
    const onRemoteSeek = ({ currentTime }) => {
      if (!isHost) {
        const time = new Date(currentTime * 1000).toISOString().substr(11, 8).replace(/^00:/, '');
        addSystemMessage(`Host jumped to ${time}`);
      }
    };

    socket.on('room:state', onRoomState);
    socket.on('room:participant-update', onParticipantUpdate);
    socket.on('room:voice-update', onVoiceUpdate);
    socket.on('room:host-changed', onHostChanged);
    socket.on('chat:message', onChatMessage);
    socket.on('video:source-changed', onSourceChanged);
    socket.on('video:uploading', onUploading);
    socket.on('chat:reaction', onReaction);
    socket.on('room:deleted', onRoomDeleted);
    socket.on('room:kicked', onKicked);
    socket.on('room:muted', onMuted);
    socket.on('room:join-request', onJoinRequest);
    socket.on('room:join-pending', onJoinPending);
    socket.on('room:join-denied', onJoinDenied);
    socket.on('room:approval-changed', onApprovalChanged);
    socket.on('room:lock-changed', onLockChanged);
    socket.on('video:play', onRemotePlay);
    socket.on('video:pause', onRemotePause);
    socket.on('video:seek', onRemoteSeek);
    socket.on('room:host-away', onHostAway);
    socket.on('room:host-back', onHostBack);
    socket.on('room:host-left', onHostLeft);
    socket.on('chat:typing', onTyping);
    socket.on('chat:message-reaction', onMessageReaction);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('room:participant-update', onParticipantUpdate);
      socket.off('room:voice-update', onVoiceUpdate);
      socket.off('room:host-changed', onHostChanged);
      socket.off('chat:message', onChatMessage);
      socket.off('video:source-changed', onSourceChanged);
      socket.off('video:uploading', onUploading);
      socket.off('chat:reaction', onReaction);
      socket.off('room:deleted', onRoomDeleted);
      socket.off('room:kicked', onKicked);
      socket.off('room:muted', onMuted);
      socket.off('room:join-request', onJoinRequest);
      socket.off('room:join-pending', onJoinPending);
      socket.off('room:join-denied', onJoinDenied);
      socket.off('room:approval-changed', onApprovalChanged);
      socket.off('room:lock-changed', onLockChanged);
      socket.off('video:play', onRemotePlay);
      socket.off('video:pause', onRemotePause);
      socket.off('video:seek', onRemoteSeek);
      socket.off('room:host-away', onHostAway);
      socket.off('room:host-back', onHostBack);
      socket.off('room:host-left', onHostLeft);
      socket.off('chat:typing', onTyping);
      socket.off('chat:message-reaction', onMessageReaction);
    };
  }, [socket, user, roomKey]);

  // ── Social Energy Decay — only when inside a room (BUG-11) ─────────────────
  useEffect(() => {
    if (!room) return; // Don't tick when no room is active
    const timer = setInterval(() => {
      setEnergy(prev => Math.max(prev - 2, 0));
    }, 2000);
    return () => clearInterval(timer);
  }, [room]);
  // Reset energy on room exit
  useEffect(() => {
    if (!room) setEnergy(0);
  }, [room]);

  // ── Typing Indicator Cleanup ──
  useEffect(() => {
    if (!room) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(username => {
          if (now - next[username] > 5000) {
            delete next[username];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [room]);

  // ── Chat actions ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content, replyTo = null) => {
    if (!socket || !room || !roomKey) return;
    
    const encryptedContent = await encryptData(content, roomKey);
    socket.emit('chat:send', { 
        roomCode: room.code, 
        content: encryptedContent, 
        replyTo,
        e2ee: true 
    });
  }, [socket, room, roomKey]);

  const sendReaction = useCallback(async (emoji) => {
    if (!socket || !room || !roomKey) return;
    const encryptedEmoji = await encryptData(emoji, roomKey);
    socket.emit('chat:reaction', { 
        roomCode: room.code, 
        emoji: encryptedEmoji,
        e2ee: true
    });
  }, [socket, room, roomKey]);

  const lastTypingEmitRef = useRef(0);
  const broadcastTyping = useCallback(() => {
    if (!socket || !room) return;
    const now = Date.now();
    // Throttle typing emissions to once every 3.5s to minimize server load
    if (now - lastTypingEmitRef.current > 3500) {
      lastTypingEmitRef.current = now;
      socket.emit('chat:typing', { roomCode: room.code });
    }
  }, [socket, room]);

  const reactToMessage = useCallback(async (messageId, emoji) => {
    if (!socket || !room || !roomKey) return;
    const encryptedEmoji = await encryptData(emoji, roomKey);
    socket.emit('chat:message-reaction', {
      roomCode: room.code,
      messageId,
      emoji: encryptedEmoji,
      e2ee: true
    });
  }, [socket, room, roomKey]);

  const setVideoSource = useCallback(async (video, opts = {}) => {
    if (!socket || !room) return;

    // Derive key inline if not yet available (fast-submit race condition)
    const key = roomKey || (await deriveKey(room.code));
    
    const encryptedUrl = await encryptData(video.url, key);
    const encryptedTitle = await encryptData(video.title, key);
    
    const encryptedVideo = {
        ...video,
        url: encryptedUrl,
        title: encryptedTitle,
        e2ee: true
    };

    socket.emit('video:set-source', {
      roomCode: room.code,
      video: encryptedVideo,
      currentTime: opts.currentTime,
      duration: opts.duration,
      isPlaying: opts.isPlaying,
    });
    
    setCurrentVideo(video); // Update locally with plain text
    if (!opts.preserveState) {
      setVideoState({ 
        currentTime: opts.currentTime ?? 0, 
        duration: opts.duration ?? 0,
        isPlaying: opts.isPlaying ?? false, 
        lastUpdated: Date.now() 
      });
    }
  }, [socket, room, roomKey]);

  const syncDuration = useCallback((duration) => {
    if (!socket || !room) return;
    socket.emit('video:sync-duration', { roomCode: room.code, duration });
    setVideoState(prev => prev ? { ...prev, duration } : { currentTime: 0, duration, isPlaying: false, lastUpdated: Date.now() });
  }, [socket, room]);

  const refreshParticipants = useCallback(() => {
    if (!socket || !room) return;
    socket.emit('room:get-participants', { roomCode: room.code });
  }, [socket, room]);

  const approveJoin = useCallback((userId) => {
    if (!socket || !room) return;
    socket.emit('room:approve-join', { roomCode: room.code, userId });
    setJoinRequests((prev) => prev.filter((r) => r.userId !== userId));
  }, [socket, room]);

  const denyJoin = useCallback((userId) => {
    if (!socket || !room) return;
    socket.emit('room:deny-join', { roomCode: room.code, userId });
    setJoinRequests((prev) => prev.filter((r) => r.userId !== userId));
  }, [socket, room]);

  const setApprovalRequired = useCallback((value) => {
    if (!socket || !room) return;
    socket.emit('room:set-approval', { roomCode: room.code, requiresApproval: value });
    setRequiresApproval(value);
  }, [socket, room]);

  const sendClip = useCallback((time) => {
    if (!socket || !room) return;
    const timeStr = new Date(time * 1000).toISOString().substr(11, 8).replace(/^00:/, '');
    addSystemMessage(`${user?.username} clipped a moment at ${timeStr}`);
    setClips(prev => [...prev, { id: Date.now(), time, username: user?.username }]);
  }, [socket, room, user, addSystemMessage]);

  const toggleRoomLock = useCallback((locked) => {
    if (!socket || !room) return;
    socket.emit('room:toggle-lock', { roomCode: room.code, isLocked: locked });
    setIsLocked(locked);
  }, [socket, room]);

  const deleteRoom = useCallback(() => {
    if (!socket || !room) return;
    sessionStorage.removeItem("vibesync_session"); // Clear immediately to prevent auto-rejoin
    socket.emit('room:delete', { roomCode: room.code });
    // Cleanup will be handled by onRoomDeleted socket listener for both host and participants
  }, [socket, room]);

  const transferHost = useCallback((targetUserId) => {
    if (!socket || !room) return;
    if (currentVideo?.type === 'live') {
      toast.error('Cannot transfer host during a live stream. Stop the stream first.');
      return;
    }
    socket.emit('room:transfer-host', { roomCode: room.code, targetUserId });
  }, [socket, room, currentVideo]);

  const kickParticipant = useCallback((targetUserId) => {
    if (!socket || !room) return;
    socket.emit('room:kick', { roomCode: room.code, targetUserId });
  }, [socket, room]);

  const muteParticipant = useCallback((targetUserId) => {
    if (!socket || !room) return;
    socket.emit('room:mute', { roomCode: room.code, targetUserId });
  }, [socket, room]);

  const muteAllParticipants = useCallback(() => {
    if (!socket || !room) return;
    socket.emit('room:mute-all', { roomCode: room.code });
  }, [socket, room]);

  const setUserStatus = useCallback((status) => {
    if (!socket || !room) return;
    socket.emit('room:set-status', { roomCode: room.code, status });
  }, [socket, room]);

  return (
    <RoomContext.Provider value={{
      room, roomKey, participants, voiceParticipants, messages,
      videoState, setVideoState, currentVideo, isHost, isMutedByHost,
      reactions, joinRoom, leaveRoom, sendMessage,
      sendReaction, setVideoSource, syncDuration,
      deleteRoom, transferHost, kickParticipant, muteParticipant,
      requiresApproval, joinRequests, joinStatus, isLocked,
      approveJoin, denyJoin, setApprovalRequired, refreshParticipants, toggleRoomLock,
      muteAllParticipants, roomEndedByHost,
      dismissRoomEnded: () => setRoomEndedByHost(null),
      unreadChatCount, setUnreadChatCount,
      chatMuted, setChatMuted,
      setUserStatus,
      energy, setEnergy,
      clips, sendClip,
      hostAway,
      typingUsers, broadcastTyping,
      reactToMessage
    }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
};
