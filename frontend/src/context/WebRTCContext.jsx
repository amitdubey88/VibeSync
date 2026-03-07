import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useRoom } from './RoomContext';
import { useAuth } from './AuthContext';
import { encryptData, decryptData } from '../utils/crypto';

const WebRTCContext = createContext();

export const WebRTCProvider = ({ children }) => {
    const { socket } = useSocket();
    const { room, roomKey } = useRoom();
    const { user } = useAuth();

    const [isInVoice, setIsInVoice] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [voiceError, setVoiceError] = useState(null);

    const localStreamRef = useRef(null);
    const premierStreamRef = useRef(null);
    const [remotePremierStream, setRemotePremierStream] = useState(null);
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

        pc.onicecandidate = async (event) => {
            if (event.candidate && socket && roomKey) {
                const encryptedCandidate = await encryptData(event.candidate, roomKey);
                socket.emit('voice:ice-candidate', {
                    targetSocketId: remoteSocketId,
                    candidate: encryptedCandidate,
                    e2ee: true
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
            } else if (event.track.kind === 'video') {
                // This is the premier stream broadcast from the host
                setRemotePremierStream(stream);
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
        }

        if (premierStreamRef.current) {
            premierStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, premierStreamRef.current));
        }

        peersRef.current[remoteSocketId] = pc;
        return pc;
    }, [socket, roomKey]);

    const closePeer = useCallback((remoteSocketId) => {
        const pc = peersRef.current[remoteSocketId];
        if (pc) {
            pc.close();
            delete peersRef.current[remoteSocketId];
        }
        const audio = document.getElementById(`audio-${remoteSocketId}`);
        if (audio) audio.remove();
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
        Object.keys(peersRef.current).forEach(closePeer);
        setIsInVoice(false);
        setIsMuted(false);
        socket.emit('voice:leave', { roomCode });
    }, [socket, roomCode, closePeer]);

    const toggleMute = useCallback(() => {
        if (!localStreamRef.current) return;
        const newMuted = !isMuted;
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
        setIsMuted(newMuted);
        if (socket && roomCode) socket.emit('voice:mute-toggle', { roomCode, isMuted: newMuted });
    }, [isMuted, socket, roomCode]);

    const setPremierStream = useCallback((stream) => {
        premierStreamRef.current = stream;
        // If we're already in voice/connected to peers, we need to add the track to existing connections
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                Object.values(peersRef.current).forEach(pc => {
                    const senders = pc.getSenders();
                    const alreadyHasVideo = senders.some(s => s.track?.kind === 'video');
                    if (!alreadyHasVideo) {
                        pc.addTrack(videoTrack, stream);
                        // Renegotiation might be needed here, but usually the other side handles ontrack fine
                        // if they are already connected. For simplicity, we assume new joiners pick it up.
                        // For existing ones, they might need a new offer.
                        pc.createOffer().then(offer => {
                            pc.setLocalDescription(offer);
                            socket.emit('voice:offer', { targetSocketId: Object.keys(peersRef.current).find(id => peersRef.current[id] === pc), offer, roomCode, e2ee: !!roomKey });
                        });
                    }
                });
            }
        }
    }, [roomCode, roomKey, socket]);

    useEffect(() => {
        if (!socket) return;
        
        const onUserJoined = async ({ socketId }) => {
            // Signal if either a microphone stream OR a premier video stream exists
            if ((!localStreamRef.current && !premierStreamRef.current) || !roomKey) return;
            const pc = createPeerConnection(socketId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            const encryptedOffer = await encryptData(offer, roomKey);
            socket.emit('voice:offer', { targetSocketId: socketId, offer: encryptedOffer, roomCode, e2ee: true });
        };

        const onOffer = async ({ fromSocketId, offer, e2ee }) => {
            // Guests can accept video offers even if they haven't enabled their own microphone
            if (!roomKey) return;
            
            let decryptedOffer = offer;
            if (e2ee) {
                decryptedOffer = await decryptData(offer, roomKey);
            }

            let pc = peersRef.current[fromSocketId] || createPeerConnection(fromSocketId);
            await pc.setRemoteDescription(new RTCSessionDescription(decryptedOffer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            const encryptedAnswer = await encryptData(answer, roomKey);
            socket.emit('voice:answer', { targetSocketId: fromSocketId, answer: encryptedAnswer, e2ee: true });
        };

        const onAnswer = async ({ fromSocketId, answer, e2ee }) => {
            const pc = peersRef.current[fromSocketId];
            if (pc && roomKey) {
                let decryptedAnswer = answer;
                if (e2ee) {
                    decryptedAnswer = await decryptData(answer, roomKey);
                }
                await pc.setRemoteDescription(new RTCSessionDescription(decryptedAnswer));
            }
        };

        const onIceCandidate = async ({ fromSocketId, candidate, e2ee }) => {
            const pc = peersRef.current[fromSocketId];
            if (pc && candidate && roomKey) {
                let decryptedCandidate = candidate;
                if (e2ee) {
                    decryptedCandidate = await decryptData(candidate, roomKey);
                }
                await pc.addIceCandidate(new RTCIceCandidate(decryptedCandidate)).catch(() => {});
            }
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
    }, [socket, roomCode, createPeerConnection, closePeer, roomKey]);

    return (
        <WebRTCContext.Provider value={{
            isInVoice, isMuted, voiceError, joinVoice, leaveVoice, toggleMute,
            setPremierStream, remotePremierStream
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
