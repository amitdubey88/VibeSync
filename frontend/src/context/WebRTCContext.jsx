import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useRoom } from './RoomContext';
import { useAuth } from './AuthContext';

const WebRTCContext = createContext();

export const WebRTCProvider = ({ children }) => {
    const { socket } = useSocket();
    const { room } = useRoom();
    const { user } = useAuth();

    const [isInVoice, setIsInVoice] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [voiceError, setVoiceError] = useState(null);
    const [remoteScreens, setRemoteScreens] = useState({}); // { [socketId]: MediaStream }

    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const peersRef = useRef({}); // { [socketId]: RTCPeerConnection }
    
    const roomCode = room?.code;

    // ── Create a peer connection ─────────────────────────────────────────────
    const createPeerConnection = useCallback((remoteSocketId) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('voice:ice-candidate', {
                    targetSocketId: remoteSocketId,
                    candidate: event.candidate,
                });
            }
        };

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (event.track.kind === 'audio') {
                let audio = document.getElementById(`audio-${remoteSocketId}`);
                if (!audio) {
                    audio = document.createElement('audio');
                    audio.id = `audio-${remoteSocketId}`;
                    audio.autoplay = true;
                    audio.playsInline = true;
                    document.body.appendChild(audio);
                }
                audio.srcObject = stream;
            }
            if (event.track.kind === 'video') {
                setRemoteScreens((prev) => ({ ...prev, [remoteSocketId]: stream }));
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, screenStreamRef.current));
        }

        peersRef.current[remoteSocketId] = pc;
        return pc;
    }, [socket]);

    const closePeer = useCallback((remoteSocketId) => {
        const pc = peersRef.current[remoteSocketId];
        if (pc) {
            pc.close();
            delete peersRef.current[remoteSocketId];
        }
        const audio = document.getElementById(`audio-${remoteSocketId}`);
        if (audio) audio.remove();

        setRemoteScreens((prev) => {
            const next = { ...prev };
            delete next[remoteSocketId];
            return next;
        });
    }, []);

    const joinVoice = useCallback(async () => {
        if (!socket || !roomCode) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            setIsInVoice(true);
            setVoiceError(null);
            socket.emit('voice:join', { roomCode });
        } catch (err) {
            setVoiceError('Microphone access denied.');
        }
    }, [socket, roomCode]);

    const leaveVoice = useCallback(() => {
        if (!socket || !roomCode) return;
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        Object.keys(peersRef.current).forEach(closePeer);
        setIsInVoice(false);
        setIsMuted(false);
        setIsSharingScreen(false);
        setRemoteScreens({});
        socket.emit('voice:leave', { roomCode });
    }, [socket, roomCode, closePeer]);

    const toggleMute = useCallback(() => {
        if (!localStreamRef.current) return;
        const newMuted = !isMuted;
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
        setIsMuted(newMuted);
        if (socket && roomCode) socket.emit('voice:mute-toggle', { roomCode, isMuted: newMuted });
    }, [isMuted, socket, roomCode]);

    const shareScreen = useCallback(async (canShare) => {
        if (!isInVoice) return setVoiceError('Join voice chat first.');
        if (!canShare) return setVoiceError('No permission.');
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            screenStreamRef.current = stream;
            const videoTrack = stream.getVideoTracks()[0];
            await Promise.all(Object.entries(peersRef.current).map(async ([peerId, pc]) => {
                pc.addTrack(videoTrack, stream);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('voice:offer', { targetSocketId: peerId, offer, roomCode });
            }));
            setIsSharingScreen(true);
            videoTrack.addEventListener('ended', () => stopScreenShare(), { once: true });
        } catch (err) {
            console.error(err);
        }
    }, [isInVoice, socket, roomCode]);

    const stopScreenShare = useCallback(async () => {
        if (!screenStreamRef.current) return;
        const videoTrack = screenStreamRef.current.getVideoTracks()[0];
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        await Promise.all(Object.entries(peersRef.current).map(async ([peerId, pc]) => {
            const sender = pc.getSenders().find(s => s.track === videoTrack);
            if (sender) pc.removeTrack(sender);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('voice:offer', { targetSocketId: peerId, offer, roomCode });
            } catch (_) {}
        }));
        screenStreamRef.current = null;
        setIsSharingScreen(false);
    }, [socket, roomCode]);

    useEffect(() => {
        if (!socket) return;
        const onUserJoined = async ({ socketId }) => {
            if (!localStreamRef.current) return;
            const pc = createPeerConnection(socketId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('voice:offer', { targetSocketId: socketId, offer, roomCode });
        };
        const onOffer = async ({ fromSocketId, offer }) => {
            if (!localStreamRef.current) return;
            let pc = peersRef.current[fromSocketId] || createPeerConnection(fromSocketId);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:answer', { targetSocketId: fromSocketId, answer });
        };
        const onAnswer = async ({ fromSocketId, answer }) => {
            const pc = peersRef.current[fromSocketId];
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
        };
        const onIceCandidate = async ({ fromSocketId, candidate }) => {
            const pc = peersRef.current[fromSocketId];
            if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        };
        const onUserLeft = ({ socketId }) => closePeer(socketId);
        const onMutedByHost = () => {
            if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
                setIsMuted(true);
            }
        };

        socket.on('voice:user-joined', onUserJoined);
        socket.on('voice:offer', onOffer);
        socket.on('voice:answer', onAnswer);
        socket.on('voice:ice-candidate', onIceCandidate);
        socket.on('voice:user-left', onUserLeft);
        socket.on('room:muted', onMutedByHost);

        return () => {
            socket.off('voice:user-joined', onUserJoined);
            socket.off('voice:offer', onOffer);
            socket.off('voice:answer', onAnswer);
            socket.off('voice:ice-candidate', onIceCandidate);
            socket.off('voice:user-left', onUserLeft);
            socket.off('room:muted', onMutedByHost);
        };
    }, [socket, roomCode, createPeerConnection, closePeer]);

    return (
        <WebRTCContext.Provider value={{
            isInVoice, isMuted, voiceError, joinVoice, leaveVoice, toggleMute,
            isSharingScreen, shareScreen, stopScreenShare, remoteScreens
        }}>
            {children}
        </WebRTCContext.Provider>
    );
};

export const useWebRTCContext = () => {
    const context = useContext(WebRTCContext);
    if (!context) throw new Error('useWebRTCContext must be used within a WebRTCProvider');
    return context;
};
