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
    const [isMuted, setIsMuted] = useState(true);
    const [voiceError, setVoiceError] = useState(null);

    const localStreamRef = useRef(null);
    const premierStreamRef = useRef(null);
    const [remotePremierStream, setRemotePremierStream] = useState(null);
    const peersRef = useRef({}); // { [socketId]: RTCPeerConnection }
    
    // Mute/unmute all remote audio elements when our voice status changes
    useEffect(() => {
        const audios = document.querySelectorAll('audio[id^="audio-"]');
        audios.forEach(a => { a.muted = !isInVoice; });
    }, [isInVoice]);
    
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
            if (event.track.kind === 'video') {
                // This is the premier stream broadcast from the host
                console.log(`[WebRTC] Received video track from ${remoteSocketId}`);
                setRemotePremierStream(stream);
                
                // If an audio tag was created for this stream's audio track prematurely, remove it
                let oldAudio = document.getElementById(`audio-${remoteSocketId}`);
                if (oldAudio && oldAudio.srcObject?.id === stream.id) {
                    oldAudio.remove();
                }
            } else if (event.track.kind === 'audio') {
                // If this audio track belongs to the premier stream, don't create a voice chat audio tag!
                // The <video> element in VideoPlayer will play it.
                if (stream.getVideoTracks().length > 0) return;

                let audio = document.getElementById(`audio-${remoteSocketId}`);
                if (!audio) {
                    audio = document.createElement('audio');
                    audio.id = `audio-${remoteSocketId}`;
                    audio.autoplay = true;
                    audio.playsInline = true;
                    document.body.appendChild(audio);
                }
                audio.srcObject = stream;
                // Mute remote audio if we are in passive mode
                audio.muted = !isInVoice;
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

    const joinVoice = useCallback(async (isPassive = false) => {
        if (!socket || !roomCode) return;
        try {
            // Only request mic if NOT passive
            if (!isPassive) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                localStreamRef.current = stream;
                
                // CRITICAL: Update all existing peer connections with the newly captured audio track
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack && roomKey) {
                    const peers = Object.entries(peersRef.current);
                    for (const [targetSocketId, pc] of peers) {
                        // Check if we already have an audio sender
                        const senders = pc.getSenders();
                        const audioSender = senders.find(s => s.track?.kind === 'audio');
                        
                        if (audioSender) {
                            audioSender.replaceTrack(audioTrack);
                        } else {
                            pc.addTrack(audioTrack, stream);
                            // Renegotiate
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            const encryptedOffer = await encryptData(offer, roomKey);
                            socket.emit('voice:offer', { targetSocketId, offer: encryptedOffer, roomCode, e2ee: true });
                        }
                    }
                }
            }
            setIsInVoice(true);
            
            setVoiceError(null);
            socket.emit('voice:join', { roomCode, passive: isPassive });
        } catch (err) {
            console.error('[WebRTC] Mic access error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setVoiceError('Microphone permission denied. Please enable it in your browser settings.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setVoiceError('No microphone found on your device.');
            } else {
                setVoiceError('Could not access microphone. It may be in use by another app.');
            }
        }
    }, [socket, roomCode, roomKey]);

    const leaveVoice = useCallback(() => {
        if (!socket || !roomCode) return;
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        Object.keys(peersRef.current).forEach(closePeer);
        setIsInVoice(false);
        setIsMuted(false);
        socket.emit('voice:leave', { roomCode });
    }, [socket, roomCode, closePeer]);

    const toggleMute = useCallback(async () => {
        // If in passive mode (listening but no mic), joining for real is what we want
        if (!localStreamRef.current) {
            await joinVoice(false);
            // If join was successful, we are now unmuted (sending audio)
            if (localStreamRef.current) setIsMuted(false);
            return;
        }

        const newMuted = !isMuted;
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
        setIsMuted(newMuted);
        if (socket && roomCode) socket.emit('voice:mute-toggle', { roomCode, isMuted: newMuted });
    }, [isMuted, joinVoice, socket, roomCode]);

    const setPremierStream = useCallback(async (stream) => {
        premierStreamRef.current = stream;
        
        // If we're already connected to peers, we need to add/update tracks
        if (socket) {
            const peers = Object.entries(peersRef.current);
            for (const [targetSocketId, pc] of peers) {
                // First, remove existing premier stream tracks from this peer
                const senders = pc.getSenders();
                senders.forEach(sender => {
                    // We can't easily tell which stream a sender belongs to natively in all browsers,
                    // but we know mic is only audio. However, we can just replace or add.
                    // Instead of removing, let's just add the tracks.
                });

                if (stream) {
                    stream.getTracks().forEach(track => {
                        // Check if we already have a sender for this track kind (video)
                        const sender = senders.find(s => s.track?.kind === track.kind && s.track?.id === track.id);
                        if (!sender) {
                            pc.addTrack(track, stream);
                        }
                    });
                } else {
                    // If stream is null (stopped), we should remove the video track sender
                    senders.forEach(sender => {
                        if (sender.track?.kind === 'video') {
                            pc.removeTrack(sender);
                        }
                    });
                }
                
                // Trigger renegotiation
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    const encryptedOffer = await encryptData(offer, roomKey);
                    socket.emit('voice:offer', { targetSocketId, offer: encryptedOffer, roomCode, e2ee: true });
                } catch (err) {
                    console.error('[WebRTC] Failed to renegotiate premier stream:', err);
                }
            }
        }
    }, [roomCode, roomKey, socket]);


    useEffect(() => {
        if (!socket) return;
        
        const onUserJoined = async ({ socketId }) => {
            // All users should initiate a peer connection to newcomers,
            // even if they don't have a local stream yet (passive listening).
            if (!roomKey) return;
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

        // Passive registration: join voice signaling pool automatically
        // This ensures video streams are received immediately upon joining
        joinVoice(true);

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
