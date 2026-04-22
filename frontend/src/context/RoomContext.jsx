'use client';

import { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';
import { Play, Star, MessageSquare, MicOff, Lock, Unlock, Radio, LogOut, XCircle } from 'lucide-react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { getRoomMessages as _getRoomMessages } from '../services/api'; // reserved for future direct API polling

import toast from 'react-hot-toast';
import { deriveKey, encryptData, decryptData } from '../utils/crypto';
import { sounds } from '../utils/soundEffects';

// Enhanced sound generator for premium UI feedback
const playUISound = (type = 'message') => {
  try {
    if (type === 'message') sounds.playNotification();
    else if (type === 'join') sounds.playJoin();
    else if (type === 'leave') sounds.playLeave();
    else if (type === 'knock') sounds.playKnock();
    else if (type === 'end') sounds.playSessionEnded();
    else if (type === 'mention') sounds.playMention();
    else if (type === 'social') sounds.playTone(600, 'sine', 0.1, 0, 0.05); // fallback
    else if (type === 'action') sounds.playTone(1200, 'sine', 0.05, 0, 0.05);
  } catch {
    // Ignore audio context issues (e.g. strict autoplay policy before interaction)
  }
};

// eslint-disable-next-line react-refresh/only-export-components
export const RoomContext = createContext(null);

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
  const [sessionSummary, setSessionSummary] = useState(null); // Feature 17
  const [typingUsers, setTypingUsers] = useState({}); // { username: timestamp }
  const [isLiveStreamingInitialized, setIsLiveStreamingInitialized] = useState(false);
  const [genieThinking, setGenieThinking] = useState(false);

  // Chat notifications state
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatMuted, setChatMuted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [energy, setEnergy] = useState(0); // 0-100 social energy
  const [clips, setClips] = useState([]); // List of timestamp highlights
  const [hostAway, setHostAway] = useState(false); // true when host temporarily disconnects
  
  const [watchQueue, setWatchQueue] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  
  // Refs to avoid stale closures in socket handlers
  const roomRef = useRef(null);
  const participantsRef = useRef([]);
  const messagesRef = useRef([]);
  const roomKeyRef = useRef(null);
  const currentVideoRef = useRef(null);
  useEffect(() => { currentVideoRef.current = currentVideo; }, [currentVideo]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { roomKeyRef.current = roomKey; }, [roomKey]);
  // Always-current ref for isHost so socket closures don't go stale (BUG-7)
  const isHostRef = useRef(false);
  const genieTimeoutRef = useRef(null);
  // Message delivery/read status: { [msgId]: 'sent' | 'delivered' | 'seen' }
  const [messageStatuses, setMessageStatuses] = useState({});

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
      deriveKey(room.code).then((key) => {
        setRoomKey(key);
        roomKeyRef.current = key; // Immediate sync for socket handlers
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoomKey(null);
      roomKeyRef.current = null;
    }
  }, [room?.code]);

  const joinRoom = useCallback(async (roomCode) => {
    if (!socket) return;
    socket.emit('room:join', { roomCode });
    
    // Derive key early for history decryption
    const key = await deriveKey(roomCode);
    setRoomKey(key);
    roomKeyRef.current = key; // Immediate sync for socket handlers

    // Message history is hydrated via onRoomState (socket event) to avoid race conditions.
  }, [socket]);


  const decryptMessageHistory = async (history, key) => {
    if (!key || !history) return history || [];
    return Promise.all(history.map(async (m) => {
      let content = m.content;
      let replyTo = m.replyTo;
      const isE2EE = m.e2ee === true || (
        m.e2ee !== false &&
        typeof m.content === 'string' &&
        m.content.length > 20 &&
        !m.content.includes(' ') &&
        /^[a-zA-Z0-9+/]*={0,2}$/.test(m.content)
      );

      if (isE2EE) {
        try { content = await decryptData(content, key); } catch { /* ignore */ }
        if (replyTo?.content && typeof replyTo.content === 'string') {
          try {
            const dec = await decryptData(replyTo.content, key);
            replyTo = { ...replyTo, content: dec };
          } catch { /* ignore */ }
        }
      }
      
      // Handle reactions
      let reactions = m.reactions || {};
      if (reactions instanceof Map) reactions = Object.fromEntries(reactions);
      const decReactions = {};
      await Promise.all(Object.entries(reactions).map(async ([emojiKey, users]) => {
        let displayKey = emojiKey;
        if (isE2EE && emojiKey.length > 6 && /^[a-zA-Z0-9+/=]+$/.test(emojiKey)) {
          try { displayKey = await decryptData(emojiKey, key); } catch { /* ignore */ }
        }
        if (!decReactions[displayKey]) decReactions[displayKey] = [];
        users.forEach(u => { if (!decReactions[displayKey].includes(u)) decReactions[displayKey].push(u); });
      }));

      return { ...m, content, replyTo, reactions: decReactions };
    }));
  };

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
  }, [videoState, videoState?.isPlaying, videoState?.lastUpdated]); // Re-sync on pause/play or hard seek

  const currentRoomCode = room?.code;
  const setVideoSource = useCallback(async (video, opts = {}) => {
    if (!socket || !currentRoomCode) return;

    if (!video) {
        // Clear video source for everyone
        socket.emit('video:set-source', {
          roomCode: currentRoomCode,
          video: null,
          currentTime: 0,
          isPlaying: false,
        });
        setCurrentVideo(null);
        setVideoState({ 
          currentTime: 0, 
          duration: 0,
          isPlaying: false, 
          lastUpdated: Date.now() 
        });
        // Reset specific live states
        setIsLiveStreamingInitialized(false);
        return;
    }

    // Derive key inline if not yet available (fast-submit race condition)
    const key = roomKey || (await deriveKey(currentRoomCode));
    
    const encryptedUrl = await encryptData(video.url, key);
    const encryptedTitle = await encryptData(video.title, key);
    const encryptedType = await encryptData(video.type, key);
    
    const encryptedVideo = {
        ...video,
        url: encryptedUrl,
        title: encryptedTitle,
        type: encryptedType,
        encryptedType: true,
        e2ee: true
    };

    socket.emit('video:set-source', {
      roomCode: currentRoomCode,
      video: {
        ...encryptedVideo,
        // Metadata intended for UI overlay/notifications (not content) doesn't need E2EE encryption
        suggestedBy: video.suggestedBy,
        suggestedById: video.suggestedById
      },
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
  }, [socket, currentRoomCode, roomKey]);

  // ── Socket event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onRoomState = async ({ room: r }) => {
      setRoom(r);
      roomRef.current = r; // Immediate sync for socket handlers
      const key = await deriveKey(r.code);
      if (!key) {
        console.error('[E2EE] Failed to derive key for room', r.code, '— crypto.subtle available:', !!window.crypto?.subtle);
      }
      setRoomKey(key);
      roomKeyRef.current = key; // Immediate sync for socket handlers

      setParticipants(r.participants || []);
      const activeVoice = (r.voiceParticipants || []).filter(p => !p.isPassive);
      setVoiceParticipants(activeVoice);
      setVideoState(r.videoState);
      
      const decryptedMessages = await decryptMessageHistory(r.messages, key);
      setMessages(decryptedMessages);

      // Decrypt video source if needed
      if (r.currentVideo && r.currentVideo.e2ee) {
        try {
          const decryptedUrl = await decryptData(r.currentVideo.url, key);
          const decryptedTitle = await decryptData(r.currentVideo.title, key);
          const decryptedType = r.currentVideo.encryptedType 
            ? await decryptData(r.currentVideo.type, key) 
            : r.currentVideo.type;
            
          setCurrentVideo({ 
            ...r.currentVideo, 
            url: decryptedUrl, 
            title: decryptedTitle, 
            type: decryptedType 
          });
        } catch (err) {
          console.error('[E2EE] Room state video decryption failed:', err);
          setCurrentVideo(r.currentVideo);
        }
      } else {
        setCurrentVideo(r.currentVideo);
      }
      
      setIsHost(r.hostId === user?.id);
      setRequiresApproval(r.requiresApproval || false);
      setIsLocked(r.isLocked || false);
      setActivePoll(r.activePoll?.active ? r.activePoll : null);
      setWatchQueue(r.watchQueue || []);
      setJoinStatus('joined'); // receiving full state means we're in
    };

    const onParticipantUpdate = ({ participants: pts }) => {
      const current = pts || [];
      participantsRef.current = current;
      setParticipants(current);
    };
    const onVoiceUpdate = ({ voiceParticipants: vp }) => {
      const active = (vp || []).filter(p => !p.isPassive);
      setVoiceParticipants(active);
    };

    const onHostChanged = ({ newHostId, newHostUsername }) => {
      
      setIsHost(String(newHostId) === String(user?.id));
      setRoom((prev) => prev ? { ...prev, hostId: newHostId } : prev);
      
      if (String(newHostId) === String(user?.id)) {
        toast.success('👑 You are now the host!');
        addSystemMessage(`You are now the room host`);
      } else {
        addSystemMessage(`${newHostUsername} is now the room host`);
      }
    };

    const onCoHostUpdated = ({ coHosts }) => {
      setRoom((prev) => prev ? { ...prev, coHosts } : prev);
    };

    const onCoHostAssigned = ({ assignedBy }) => {
      toast.success(`You have been promoted to Co-Host by ${assignedBy}!`, { 
        icon: <Star className="w-5 h-5 text-accent-purple" />,
        duration: 4000 
      });
    };

    const onChatMessage = async (msg) => {
      // Use ref to always get the latest key (avoids stale closure).
      // Fall back to on-demand derivation if the key hasn't been set yet.
      const currentRoom = roomRef.current;
      let key = roomKeyRef.current;
      if (!key && currentRoom?.code) {
        key = await deriveKey(currentRoom.code);
        if (key) {
          roomKeyRef.current = key;
          setRoomKey(key);
        }
      }

      let displayContent = msg.content;
      if (msg.e2ee && key) {
        displayContent = await decryptData(msg.content, key);
      }
      
      let replyTo = msg.replyTo;
      if (replyTo && msg.e2ee && key && replyTo.content) {
        const decryptedReplyContent = await decryptData(replyTo.content, key);
        replyTo = { ...replyTo, content: decryptedReplyContent };
      }

      const decryptedMsg = { ...msg, content: displayContent, replyTo };
      
      // Decrypt system messages that use systemType: 'video-source'
      if (decryptedMsg.e2ee && decryptedMsg.systemType === 'video-source' && key) {
        // displayContent is already the decrypted title (since it was decrypted above)
        decryptedMsg.content = `Video set to: ${displayContent}`;
      }

      setMessages((prev) => {
        // Deduplicate: Don't add if ID already exists (fixes race condition between history and live event)
        if (prev.some(m => m.id === decryptedMsg.id)) return prev;
        return [...prev, decryptedMsg];
      });

      // Emit delivered ACK for messages from others so the sender sees double-ticks
      if (msg.userId !== user?.id && msg.username !== user?.username && currentRoom?.code) {
        socket.emit('chat:delivered', { roomCode: currentRoom.code, messageIds: [msg.id] });
      }
      
      // If it's not my message, check if we need to notify
      if (msg.userId !== user?.id && msg.username !== user?.username) {
        if (msg.type !== 'system') setUnreadChatCount((prev) => prev + 1);
        
        setChatMuted((isMuted) => {
          if (!isMuted) {
            if (msg.type === 'system') {
              if (displayContent.includes('joined the room')) playUISound('join');
              else if (displayContent.includes('left the room') || displayContent.includes('removed from')) playUISound('leave');
              else playUISound('social');
            } else {
              if (displayContent.toLowerCase().includes(`@${user?.username?.toLowerCase()}`) || displayContent.toLowerCase().includes('@genie')) {
                playUISound('mention');
              } else {
                playUISound('message');
              }
              setEnergy(prev => Math.min(prev + 10, 100)); // Boost energy
              toast(`${msg.username}: ${displayContent.length > 30 ? displayContent.substring(0, 30) + '...' : displayContent}`, {
                duration: 2000,
                icon: <MessageSquare className="w-5 h-5 text-accent-purple" />,
                id: `chat-${msg.id}`
              });
            }
          }
          return isMuted;
        });
      }
    };

    const onSourceChanged = async ({ video, videoState: vs }) => {
      let displayVideo = video;
      if (video?.e2ee) {
        // Use ref to always get the latest key (avoids stale closure).
        // Fall back to on-demand derivation if the key hasn't been set yet.
        const currentRoom = roomRef.current;
        const key = roomKeyRef.current || (currentRoom?.code ? await deriveKey(currentRoom.code) : null);
        if (key) {
          try {
            const decryptedUrl = await decryptData(video.url, key);
            const decryptedTitle = await decryptData(video.title, key);
            const decryptedType = video.encryptedType 
              ? await decryptData(video.type, key) 
              : video.type;
            displayVideo = { ...video, url: decryptedUrl, title: decryptedTitle, type: decryptedType };
          } catch (err) {
            console.error('[E2EE] Source changed video decryption failed:', err);
          }
        }
      }
      setCurrentVideo(displayVideo);
      setVideoState(vs);

      // ── Playback Notification Logic ──
      // Use decrypted title if available, fallback to video.title or 'Untitled'
      const title = displayVideo.title || video.title || 'Untitled Video';
      
      // Personalized toast based on suggestion metadata
      if (displayVideo.suggestedById) {
        if (displayVideo.suggestedById === user?.id) {
          toast(`Your suggested video "${title}" is now playing!`, {
            icon: <Play className="w-5 h-5 text-accent-red" />,
            duration: 5000,
            id: `play-suggest-${displayVideo.url}`
          });
        } else {
          toast(`${displayVideo.suggestedBy}'s suggested video "${title}" is now playing!`, {
            icon: <Play className="w-5 h-5 text-accent-red" />,
            duration: 4000,
            id: `play-suggest-${displayVideo.url}`
          });
        }
      } else if (displayVideo.type !== 'uploading' && displayVideo.url !== 'live-stream') {
        // Standard host load notification
        toast(`Host is now playing: ${title}`, {
          icon: <Play className="w-5 h-5 text-accent-red" />,
          duration: 3500,
          id: `play-host-${displayVideo.url}`
        });
      }
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
      playUISound('end');
      
      // Only count actual chat message bubbles (exclude system notifications and polls)
      const chatMessagesCount = (messagesRef.current || []).filter(m => m.type !== 'system' && m.type !== 'poll').length;

      const summary = {
        name: roomRef.current?.name || 'VibeSync Room',
        participantsCount: participantsRef.current?.length || 0,
        messagesCount: chatMessagesCount
      };
      
      // Use the ref so we always read the CURRENT value, not a stale closure (BUG-7)
      if (isHostRef.current) {
        sessionStorage.removeItem("vibesync_session");
        setRoom(null); setParticipants([]); setMessages([]);
        setVideoState(null); setCurrentVideo(null); setIsHost(false);
        setSessionSummary(summary);
        return;
      }

      setRoomEndedByHost({ message: message || 'The host has ended this session.' });
      setSessionSummary(summary);
      setRoom(null); setParticipants([]); setMessages([]);
      setVideoState(null); setCurrentVideo(null); setIsHost(false);
    };

    const onKicked = ({ message }) => {
      playUISound('end');
      toast.error(message || 'You were removed from the room.', { duration: 4000 });
      
      // Clear session to prevent auto-rejoin
      sessionStorage.removeItem("vibesync_session");

      setRoom(null); setParticipants([]); setMessages([]);
      setVideoState(null); setCurrentVideo(null); setIsHost(false);
      
      setTimeout(() => {
        // Use navigate if possible, otherwise fallback to href
        window.location.href = '/?kicked=1';
      }, 1500);
    };

    const onMuted = () => {
      setIsMutedByHost(true);
      toast('You were muted by the host', { 
        icon: <MicOff className="w-5 h-5 text-red-500" />,
        duration: 2000 
      });
    };

    const onJoinRequest = (req) => {
      setJoinRequests((prev) => {
        if (prev.find((r) => r.userId === req.userId)) return prev;
        playUISound('knock');
        return [...prev, req];
      });
    };
    const onJoinPending = () => setJoinStatus('pending');
    const onJoinDenied = ({ message }) => {
      setJoinStatus('denied');
      toast.error(message || 'Your join request was declined.', { 
        icon: <XCircle className="w-5 h-5 text-red-500" />,
        duration: 2000 
      });
      setTimeout(() => { window.location.href = '/'; }, 2000);
    };
    const onApprovalChanged = ({ requiresApproval: ra }) => setRequiresApproval(ra);
    
    const onLockChanged = ({ isLocked: locked }) => {
      setIsLocked(locked);
      if (locked) toast('The room has been locked by the host.', { 
        icon: <Lock className="w-5 h-5 text-accent-purple" />, 
        duration: 2000 
      });
      else toast('The room is now unlocked.', { 
        icon: <Unlock className="w-5 h-5 text-accent-green" />, 
        duration: 2000 
      });
    };

    // ── Host away/back events (BUG-13) ───────────────────────────────────────
    const onHostAway = ({ message }) => {
      setHostAway(true);
      toast(message || 'Host disconnected…', { 
        icon: <Radio className="w-5 h-5 text-accent-red animate-pulse" />, 
        duration: 4000 
      });
    };
    const onHostBack = ({ message }) => {
      setHostAway(false);
      toast.success(message || 'Host reconnected!', { duration: 2000 });
    };
    const onHostLeft = ({ message }) => {
      setHostAway(false);
      toast(message || 'The host has left.', { 
        icon: <LogOut className="w-5 h-5 text-accent-red" />, 
        duration: 5000 
      });
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
        try { displayEmoji = await decryptData(emoji, roomKey); } catch { /* ignore decryption failure */ }
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
            
            // Notify other participants (and specifically the message owner)
            if (username !== user?.username) {
              const isMyMessage = m.username === user?.username;
              toast(`${username} reacted with ${displayEmoji}${isMyMessage ? ' to your message' : ''}`, {
                icon: '✨',
                duration: 2000,
                id: `msg-react-${messageId}-${username}-${displayEmoji}`
              });
              playUISound('social');
            }

            const nextReactions = { ...reactions, [displayEmoji]: [...users, username] };
            return { ...m, reactions: nextReactions };
          }
        }
        return m;
      }));
    };

    // ── Delivered / Seen receipts ─────────────────────────────────────────────
    const onDelivered = ({ messageIds }) => {
      setMessageStatuses(prev => {
        const next = { ...prev };
        (messageIds || []).forEach(id => {
          // Only upgrade status (sent → delivered → seen)
          if (!next[id] || next[id] === 'sent') next[id] = 'delivered';
        });
        return next;
      });
    };

    const onRead = ({ messageIds }) => {
      setMessageStatuses(prev => {
        const next = { ...prev };
        (messageIds || []).forEach(id => { next[id] = 'seen'; });
        return next;
      });
    };

    const onRemotePlay = () => {
      // Notification removed as per user request
    };
    const onRemotePause = () => {
      // Notification removed as per user request
    };
    const onRemoteSeek = () => {
      // Notification removed as per user request (decluttering playback noise)
    };


    socket.on('room:state', onRoomState);
    socket.on('room:participant-update', onParticipantUpdate);
    socket.on('room:voice-update', onVoiceUpdate);
    socket.on('room:host-changed', onHostChanged);
    socket.on('room:cohost-updated', onCoHostUpdated);
    socket.on('room:cohost-assigned', onCoHostAssigned);
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
    const onQueueUpdated = ({ queue }) => {
      setWatchQueue(queue);
      setRoom(prev => prev ? { ...prev, watchQueue: queue } : null);
    };

    const onQueueLoadVideo = ({ video }) => {
      if (!video?.url) return;
      setVideoSource({
        url: video.url,
        title: video.title || 'Queue Video',
        type: video.type || 'direct',
        suggestedBy: video.suggestedBy,
        suggestedById: video.suggestedById
      });
    };

    const onQueueSuggested = ({ item }) => {
      if (item.suggestedById === user?.id) return;
      toast(`${item.suggestedBy} suggested: ${item.title || 'a video'}`, { 
        icon: <Play className="w-5 h-5 text-accent-red" /> 
      });
    };

    const onPollUpdate = ({ poll }) => setActivePoll(poll?.active ? poll : null);

    const onGeminiResponse = async ({ text }) => {
      // Clear safety timeout immediately on receiving any response
      if (genieTimeoutRef.current) {
        clearTimeout(genieTimeoutRef.current);
        genieTimeoutRef.current = null;
      }
      setGenieThinking(false);

      const currentRoom = roomRef.current;
      const key = roomKeyRef.current;
      if (currentRoom?.code && key) {
        try {
          const encryptedContent = await encryptData(text, key);
          socket.emit('chat:send-bot', {
              roomCode: currentRoom.code,
              botName: 'Genie',
              botAvatar: 'https://www.gstatic.com/lamda/images/sparkle_resting_v2_darkmode_2bdb7df2724e4500732432bd3c5f9586.gif',
              content: encryptedContent,
              e2ee: true
          });
        } catch (err) {
          console.error('[E2EE] Failed to encrypt Gemini response', err);
        }
      }
    };

    socket.on('chat:typing', onTyping);
    socket.on('chat:message-reaction', onMessageReaction);
    socket.on('chat:delivered', onDelivered);
    socket.on('chat:read', onRead);
    socket.on('poll:created', onPollUpdate);
    socket.on('poll:updated', onPollUpdate);
    socket.on('poll:ended', onPollUpdate);
    socket.on('queue:updated', onQueueUpdated);
    socket.on('queue:suggested', onQueueSuggested);
    socket.on('queue:load-video', onQueueLoadVideo);
    socket.on('chat:gemini-response', onGeminiResponse);
    socket.on('chat:genie-thinking', ({ thinking }) => {
      setGenieThinking(thinking);
      
      // Safety Timer: If Genie starts thinking, schedule a forced reset in 45s
      // to prevent UI hangs if server reset message is lost.
      if (thinking) {
        if (genieTimeoutRef.current) clearTimeout(genieTimeoutRef.current);
        genieTimeoutRef.current = setTimeout(() => {
          console.warn('[Genie] Response timed out. Forcing thinking state to false.');
          setGenieThinking(false);
          genieTimeoutRef.current = null;
        }, 45000); // 45s safety window
      } else {
        if (genieTimeoutRef.current) {
          clearTimeout(genieTimeoutRef.current);
          genieTimeoutRef.current = null;
        }
      }
    });

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('room:participant-update', onParticipantUpdate);
      socket.off('room:voice-update', onVoiceUpdate);
      socket.off('room:host-changed', onHostChanged);
      socket.off('room:cohost-updated', onCoHostUpdated);
      socket.off('room:cohost-assigned', onCoHostAssigned);
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
      socket.off('chat:delivered', onDelivered);
      socket.off('chat:read', onRead);
      socket.off('poll:created', onPollUpdate);
      socket.off('poll:updated', onPollUpdate);
      socket.off('poll:ended', onPollUpdate);
      socket.off('queue:updated', onQueueUpdated);
      socket.off('queue:suggested', onQueueSuggested);
      socket.off('queue:load-video', onQueueLoadVideo);
      socket.off('chat:gemini-response', onGeminiResponse);
    };
    // NOTE: roomKey and room?.code removed from deps — handlers now use roomKeyRef/roomRef
    // to avoid tearing down all listeners on every key/room change (which caused missed events).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user, addSystemMessage, setVideoSource]);


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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (!socket) return;

    // Use refs for the latest room/key, with on-demand derivation fallback
    const currentRoom = roomRef.current;
    if (!currentRoom) return;

    let key = roomKeyRef.current;
    if (!key && currentRoom.code) {
      key = await deriveKey(currentRoom.code);
      if (key) {
        roomKeyRef.current = key;
        setRoomKey(key);
      }
    }
    if (!key) {
      console.error('[E2EE] Cannot send message — key derivation failed. crypto.subtle:', !!window.crypto?.subtle);
      return;
    }
    
    const encryptedContent = await encryptData(content, key);
    let finalReplyTo = replyTo;
    
    // Also encrypt the context being replied to so it doesn't fail decryption on load
    if (replyTo && replyTo.content) {
      const encryptedReplyContent = await encryptData(replyTo.content, key);
      finalReplyTo = { ...replyTo, content: encryptedReplyContent };
    }

    socket.emit('chat:send', { 
      roomCode: currentRoom.code, 
        content: encryptedContent, 
        replyTo: finalReplyTo,
        e2ee: true 
    });

    const isGenieMention = content.toLowerCase().match(/@genie\b/i);
    const isReplyToGenie = replyTo?.username === 'Genie';

    if (isGenieMention || isReplyToGenie) {
      setGenieThinking(true);
      const recentContext = messagesRef.current.slice(-10).map(m => ({
        username: m.username,
        content: m.content
      }));

      // If it's a reply, we can make the prompt more explicit about the context
      let finalPrompt = content;
      if (isReplyToGenie && !isGenieMention) {
        // Automatically prepend context for the AI if not explicitly mentioned
        // This ensures the AI knows it was invited to the conversation via a reply
        finalPrompt = `[Replying to your previous message] ${content}`;
      }

      socket.emit('chat:gemini-prompt', {
        roomCode: currentRoom.code,
        prompt: finalPrompt,
        context: recentContext,
        currentVideo: currentVideoRef?.current
      });
    }
  }, [socket]);

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
    if (!socket || !room) return;
    // Emojis are sent in plaintext — they aren't sensitive and must be consistent
    // for proper grouping on the backend (encrypted emojis produce different ciphertexts
    // per user, preventing reactions from being merge/grouped correctly).
    socket.emit('chat:message-reaction', {
      roomCode: room.code,
      messageId,
      emoji, // plaintext emoji
      e2ee: false
    });
  }, [socket, room]);

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

  // Feature 12: Playback Speed Voting — host applies the agreed-upon speed
  const updatePlaybackSpeed = useCallback((speed) => {
    if (!socket || !room) return;
    socket.emit('video:set-speed', { roomCode: room.code, speed });
  }, [socket, room]);

  // ── Watch Queue Helpers ──
  const suggestVideo = useCallback((video) => {
    if (!socket || !room) return;
    socket.emit('queue:suggest', { roomCode: room.code, video });
  }, [socket, room]);

  const approveQueueItem = useCallback((itemId) => {
    if (!socket || !room) return;
    socket.emit('queue:approve', { roomCode: room.code, itemId });
  }, [socket, room]);

  const removeFromQueue = useCallback((itemId) => {
    if (!socket || !room) return;
    socket.emit('queue:remove', { roomCode: room.code, itemId });
  }, [socket, room]);

  const reorderQueue = useCallback((orderedIds) => {
    if (!socket || !room) return;
    socket.emit('queue:reorder', { roomCode: room.code, orderedIds });
    // Optimistic UI update
    setWatchQueue(prev => {
      const qMap = Object.fromEntries(prev.map(item => [item.id, item]));
      return orderedIds.map(id => qMap[id]).filter(Boolean);
    });
  }, [socket, room]);

  // ── Poll Helpers ──
  const createPoll = useCallback((question, options) => {
    if (!socket || !room) return;
    socket.emit('poll:create', { roomCode: room.code, question, options });
  }, [socket, room]);

  const votePoll = useCallback((pollId, optionId) => {
    if (!socket || !room) return;
    socket.emit('poll:vote', { roomCode: room.code, pollId, optionId });
  }, [socket, room]);

  const endPoll = useCallback((pollId) => {
    if (!socket || !room) return;
    socket.emit('poll:end', { roomCode: room.code, pollId });
  }, [socket, room]);

  // Marks messages as seen from the current user's perspective;
  // called by ChatPanel when the user focuses on the chat.
  const markChatRead = useCallback((messageIds) => {
    if (!socket || !room || !messageIds.length) return;
    socket.emit('chat:read', { roomCode: room.code, messageIds });
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
      sessionSummary, setSessionSummary, // Feature 17
      dismissRoomEnded: () => setRoomEndedByHost(null),
      unreadChatCount, setUnreadChatCount,
      chatMuted, setChatMuted,
      setUserStatus,
      energy, setEnergy,
      clips, sendClip,
      hostAway,
      typingUsers, broadcastTyping,
      genieThinking,
      reactToMessage,
      messageStatuses, markChatRead,
      isLiveStreamingInitialized, setIsLiveStreamingInitialized,
      updatePlaybackSpeed, // Feature 12
      watchQueue, suggestVideo, approveQueueItem, removeFromQueue, reorderQueue,
      activePoll, createPoll, votePoll, endPoll,
    }}>
      {children}
    </RoomContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used within a RoomProvider');
  return context;
};


