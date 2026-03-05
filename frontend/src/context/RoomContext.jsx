import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { getRoomMessages } from '../services/api';
import toast from 'react-hot-toast';

const RoomContext = createContext(null);

export const RoomProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [videoState, setVideoState] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [isMutedByHost, setIsMutedByHost] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  // joinRequests: pending approval requests shown to host
  const [joinRequests, setJoinRequests] = useState([]);
  // joinStatus: 'joined' | 'pending' | 'denied'
  const [joinStatus, setJoinStatus] = useState('joined');

  const joinRoom = useCallback(async (roomCode) => {
    if (!socket) return;
    socket.emit('room:join', { roomCode });
    try {
      const { messages: history } = await getRoomMessages(roomCode);
      setMessages(history || []);
    } catch (_) {}
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (!socket || !room) return;
    socket.emit('room:leave');
    setRoom(null);
    setParticipants([]);
    setMessages([]);
    setVideoState(null);
    setCurrentVideo(null);
    setIsHost(false);
    setVoiceParticipants([]);
    setIsMutedByHost(false);
  }, [socket, room]);

  // ── Socket event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onRoomState = ({ room: r }) => {
      setRoom(r);
      setParticipants(r.participants || []);
      setVoiceParticipants(r.voiceParticipants || []);
      setVideoState(r.videoState);
      setCurrentVideo(r.currentVideo);
      setIsHost(r.hostId === user?.id);
      setRequiresApproval(r.requiresApproval || false);
      setJoinStatus('joined'); // receiving full state means we're in
    };

    const onParticipantUpdate = ({ participants: pts }) => setParticipants(pts || []);
    const onVoiceUpdate = ({ voiceParticipants: vp }) => setVoiceParticipants(vp || []);

    const onHostChanged = ({ newHostId, newHostUsername }) => {
      setIsHost(newHostId === user?.id);
      setRoom((prev) => prev ? { ...prev, hostId: newHostId } : prev);
      if (newHostId === user?.id) toast.success('👑 You are now the host!');
    };

    const onChatMessage = (msg) => setMessages((prev) => [...prev, msg]);

    const onSourceChanged = ({ video, videoState: vs }) => {
      setCurrentVideo(video);
      setVideoState(vs);
    };

    // ── host started background upload ──────────────────────────────────────
    const onUploading = ({ title }) => {
      setCurrentVideo({ type: 'uploading', title, url: null });
    };

    const onReaction = (reaction) => {
      const id = reaction.id;
      setReactions((prev) => [...prev, { ...reaction, id }]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3500);
    };

    // ── room deleted → hard redirect for all participants ───────────────────
    const onRoomDeleted = ({ message }) => {
      toast.error(message || 'The room has been deleted.', { duration: 4000 });
      setRoom(null); setParticipants([]); setMessages([]);
      setVideoState(null); setCurrentVideo(null); setIsHost(false);
      setTimeout(() => {
        window.history.replaceState(null, '', '/');
        window.location.href = '/';
      }, 800);
    };

    // ── kicked → hard redirect ─────────────────────────────────────────────
    const onKicked = ({ message }) => {
      toast.error(message || 'You were removed from the room.', { duration: 4000 });
      setRoom(null); setParticipants([]); setMessages([]);
      setVideoState(null); setCurrentVideo(null); setIsHost(false);
      setTimeout(() => {
        window.history.replaceState(null, '', '/');
        window.location.href = '/';
      }, 800);
    };

    const onMuted = () => {
      setIsMutedByHost(true);
      toast('🔇 You were muted by the host', { duration: 3000 });
    };

    // ── Join approval events ────────────────────────────────────────────────────────
    // Host receives a join request from pending user
    const onJoinRequest = (req) => {
      setJoinRequests((prev) => {
        if (prev.find((r) => r.userId === req.userId)) return prev;
        return [...prev, req];
      });
    };
    // Joiner is placed in pending state
    const onJoinPending = () => setJoinStatus('pending');
    // Joiner was denied
    const onJoinDenied = ({ message }) => {
      setJoinStatus('denied');
      toast.error(message || 'Your join request was declined.', { duration: 5000 });
      setTimeout(() => { window.location.href = '/'; }, 2500);
    };
    // Approval requirement toggle
    const onApprovalChanged = ({ requiresApproval: ra }) => setRequiresApproval(ra);

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
    };
  }, [socket, user]);

  // ── Chat actions ──────────────────────────────────────────────────────────
  const sendMessage = useCallback((content) => {
    if (!socket || !room) return;
    socket.emit('chat:send', { roomCode: room.code, content });
  }, [socket, room]);

  const sendReaction = useCallback((emoji) => {
    if (!socket || !room) return;
    socket.emit('chat:reaction', { roomCode: room.code, emoji });
  }, [socket, room]);

  // setVideoSource: emit to socket for YouTube/URL changes;
  // for file uploads pass currentTime+isPlaying so participants sync to host position
  const setVideoSource = useCallback((video, opts = {}) => {
    if (!socket || !room) return;
    socket.emit('video:set-source', {
      roomCode: room.code,
      video,
      currentTime: opts.currentTime,
      isPlaying: opts.isPlaying,
    });
    setCurrentVideo(video);
    if (!opts.preserveState) {
      setVideoState({ currentTime: opts.currentTime ?? 0, isPlaying: opts.isPlaying ?? false, lastUpdated: Date.now() });
    }
  }, [socket, room]);

  // notifyUploading: tell participants host is uploading a local file
  const notifyUploading = useCallback((title) => {
    if (!socket || !room) return;
    socket.emit('video:set-uploading', { roomCode: room.code, title });
  }, [socket, room]);

  // refreshParticipants: ask server for the latest list right now
  // This fixes the race-condition where host misses room:participant-update
  const refreshParticipants = useCallback(() => {
    if (!socket || !room) return;
    socket.emit('room:get-participants', { roomCode: room.code });
  }, [socket, room]);

  // ── Host approval actions ────────────────────────────────────────────────────────
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

  // ── Host control actions ──────────────────────────────────────────────────
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

  return (
    <RoomContext.Provider value={{
      room, participants, voiceParticipants, messages,
      videoState, setVideoState, currentVideo, isHost, isMutedByHost,
      reactions, joinRoom, leaveRoom, sendMessage,
      sendReaction, setVideoSource, notifyUploading,
      deleteRoom, transferHost, kickParticipant, muteParticipant,
      // Join approval
      requiresApproval, joinRequests, joinStatus,
      approveJoin, denyJoin, setApprovalRequired, refreshParticipants,
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
