import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { getRoomMessages } from '../services/api';

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

  const joinRoom = useCallback(async (roomCode) => {
    if (!socket) return;
    socket.emit('room:join', { roomCode });

    // Load chat history
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
    };

    const onParticipantUpdate = ({ participants: pts }) => {
      setParticipants(pts || []);
    };

    const onVoiceUpdate = ({ voiceParticipants: vp }) => {
      setVoiceParticipants(vp || []);
    };

    const onHostChanged = ({ newHostId }) => {
      setIsHost(newHostId === user?.id);
      setRoom((prev) => prev ? { ...prev, hostId: newHostId } : prev);
    };

    const onChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const onSourceChanged = ({ video, videoState: vs }) => {
      setCurrentVideo(video);
      setVideoState(vs);
    };

    const onReaction = (reaction) => {
      const id = reaction.id;
      setReactions((prev) => [...prev, { ...reaction, id }]);
      // Auto-remove after animation
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3500);
    };

    socket.on('room:state', onRoomState);
    socket.on('room:participant-update', onParticipantUpdate);
    socket.on('room:voice-update', onVoiceUpdate);
    socket.on('room:host-changed', onHostChanged);
    socket.on('chat:message', onChatMessage);
    socket.on('video:source-changed', onSourceChanged);
    socket.on('chat:reaction', onReaction);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('room:participant-update', onParticipantUpdate);
      socket.off('room:voice-update', onVoiceUpdate);
      socket.off('room:host-changed', onHostChanged);
      socket.off('chat:message', onChatMessage);
      socket.off('video:source-changed', onSourceChanged);
      socket.off('chat:reaction', onReaction);
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

  // ── Video source actions ──────────────────────────────────────────────────
  const setVideoSource = useCallback((video) => {
    if (!socket || !room) return;
    socket.emit('video:set-source', { roomCode: room.code, video });
    setCurrentVideo(video);
    setVideoState({ currentTime: 0, isPlaying: false, lastUpdated: Date.now() });
  }, [socket, room]);

  return (
    <RoomContext.Provider value={{
      room, participants, voiceParticipants, messages,
      videoState, setVideoState, currentVideo, isHost,
      reactions, joinRoom, leaveRoom, sendMessage,
      sendReaction, setVideoSource,
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
