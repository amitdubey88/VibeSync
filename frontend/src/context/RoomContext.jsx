import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { getRoomMessages } from '../services/api';
import toast from 'react-hot-toast';
import { deriveKey, encryptData, decryptData } from '../utils/crypto';

// Simple beep generator for notifications without needing an external audio file
const playNotifySound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Quick, pleasant "pop" sound
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // Ignore audio context errors (e.g. if user hasn't interacted with page yet)
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
  const [reactions, setReactions] = useState([]);
  const [isMutedByHost, setIsMutedByHost] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinStatus, setJoinStatus] = useState('joined');
  // roomEndedByHost: set when host deletes the room, shows a persistent modal
  const [roomEndedByHost, setRoomEndedByHost] = useState(null); // null | { message }

  // Chat notifications state
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatMuted, setChatMuted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

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
        if (m.type === 'text' && typeof m.content === 'string' && m.content.length > 20) {
           const decrypted = await decryptData(m.content, key);
           return { ...m, content: decrypted };
        }
        return m;
      }));
      setMessages(decryptedHistory);
    } catch (_) {}
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (!socket || !room) return;
    socket.emit('room:leave');
    setRoom(null);
    setRoomKey(null);
    setParticipants([]);
    setMessages([]);
    setVideoState(null);
    setCurrentVideo(null);
    setIsHost(false);
    setVoiceParticipants([]);
    setIsMutedByHost(false);
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

    const onParticipantUpdate = ({ participants: pts }) => setParticipants(pts || []);
    const onVoiceUpdate = ({ voiceParticipants: vp }) => {
      const active = (vp || []).filter(p => !p.isPassive);
      setVoiceParticipants(active);
    };

    const onHostChanged = ({ newHostId, newHostUsername }) => {
      setIsHost(newHostId === user?.id);
      setRoom((prev) => prev ? { ...prev, hostId: newHostId } : prev);
      if (newHostId === user?.id) toast.success('👑 You are now the host!');
    };

    const onChatMessage = async (msg) => {
      let displayContent = msg.content;
      if (msg.e2ee && roomKey) {
        displayContent = await decryptData(msg.content, roomKey);
      }
      
      const decryptedMsg = { ...msg, content: displayContent };
      setMessages((prev) => [...prev, decryptedMsg]);
      
      // If it's not my message, check if we need to notify
      if (msg.userId !== user?.id && msg.username !== user?.username) {
        setUnreadChatCount((prev) => prev + 1);
        
        setChatMuted((isMuted) => {
          if (!isMuted) {
            playNotifySound();
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
      if (video?.e2ee && roomKey) {
        const decryptedUrl = await decryptData(video.url, roomKey);
        const decryptedTitle = await decryptData(video.title, roomKey);
        displayVideo = { ...video, url: decryptedUrl, title: decryptedTitle };
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
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3500);
    };

    const onRoomDeleted = ({ message }) => {
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
    };
  }, [socket, user, roomKey]);

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

  const setVideoSource = useCallback(async (video, opts = {}) => {
    if (!socket || !room || !roomKey) return;
    
    const encryptedUrl = await encryptData(video.url, roomKey);
    const encryptedTitle = await encryptData(video.title, roomKey);
    
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

  const notifyUploading = useCallback((title) => {
    if (!socket || !room) return;
    socket.emit('video:set-uploading', { roomCode: room.code, title });
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

  const toggleRoomLock = useCallback((locked) => {
    if (!socket || !room) return;
    socket.emit('room:toggle-lock', { roomCode: room.code, isLocked: locked });
    setIsLocked(locked);
  }, [socket, room]);

  const deleteRoom = useCallback(() => {
    if (!socket || !room) return;
    socket.emit('room:delete', { roomCode: room.code });
  }, [socket, room]);

  const transferHost = useCallback((targetUserId) => {
    if (!socket || !room) return;
    socket.emit('room:transfer-host', { roomCode: room.code, targetUserId });
  }, [socket, room]);

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
      sendReaction, setVideoSource, notifyUploading, syncDuration,
      deleteRoom, transferHost, kickParticipant, muteParticipant,
      requiresApproval, joinRequests, joinStatus, isLocked,
      approveJoin, denyJoin, setApprovalRequired, refreshParticipants, toggleRoomLock,
      muteAllParticipants, roomEndedByHost,
      dismissRoomEnded: () => setRoomEndedByHost(null),
      unreadChatCount, setUnreadChatCount,
      chatMuted, setChatMuted,
      setUserStatus
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
