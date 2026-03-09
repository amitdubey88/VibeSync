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
    const hasJoinedPassivelyRef = useRef(false); // prevent duplicate passive joins
    
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
                // Tracks for the same stream arrive asynchronously. Delay slightly to see if a video track arrives.
                setTimeout(() => {
                    // If this audio track belongs to the premier stream, don't create a voice chat audio tag!
                    // The <video> element in VideoPlayer will play it.
                    if (stream.getVideoTracks().length > 0) return;

                    let audio = document.getElementById(`audio-${remoteSocketId}`); // unique to the track/stream?
                    // Actually, if a user has multiple audio streams, we need unique IDs per stream to avoid overriding
                    const audioId = `audio-${remoteSocketId}-${stream.id}`;
                    if (!audio) {
                        audio = document.createElement('audio');
                        audio.id = audioId;
                        audio.autoplay = true;
                        audio.playsInline = true;
                        audio.dataset.socketId = remoteSocketId; // save for cleanup
                        document.body.appendChild(audio);
                    }
                    audio.srcObject = stream;
                    // Mute remote voice chat if we are in passive mode
                    audio.muted = !isInVoice;
                }, 100);
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
        
        if (!socket || !roomCode) return;

        if (stream) {
            // Signal all participants to refresh their connections.
            // Renegotiation of existing connections is unreliable (signaling state
            // may not be stable, or ICE may still be gathering). The reliable
            // approach: close all current peers, signal everyone to re-join voice,
            // and create fresh connections that include the video track from the start.
            socket.emit('voice:premier-started', { roomCode });

            // Close our own stale peers so the host starts fresh too.
            // When participants re-emit voice:join, host will get voice:user-joined
            // and createPeerConnection() will attach premierStreamRef tracks.
            Object.keys(peersRef.current).forEach(closePeer);
        } else {
            // Stream stopped — remove video senders from all existing peers
            const peers = Object.entries(peersRef.current);
            for (const [targetSocketId, pc] of peers) {
                const senders = pc.getSenders();
                senders.forEach(sender => {
                    if (sender.track?.kind === 'video') {
                        pc.removeTrack(sender);
                    }
                });
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    const encryptedOffer = await encryptData(offer, roomKey);
                    socket.emit('voice:offer', { targetSocketId, offer: encryptedOffer, roomCode, e2ee: true });
                } catch (err) {
                    console.error('[WebRTC] Failed to renegotiate stream stop:', err);
                }
            }
        }
    }, [roomCode, roomKey, socket, closePeer]);


    // ── Socket event listeners for WebRTC signaling ─────────────────────────
    // NOTE: These are kept separate from the passive join so that listeners
    // are always registered, even before roomKey is ready.
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

        // Host started a live stream — close stale peer connections and re-announce
        // so the host creates fresh connections that include the video track.
        const onPremierStarted = () => {
            console.log('[WebRTC] voice:premier-started received — refreshing peer connections for video');
            // Close all existing stale peers
            Object.keys(peersRef.current).forEach(closePeer);
            // Reset passive join guard so we can re-join
            hasJoinedPassivelyRef.current = false;
            // Re-emit voice:join — server will send voice:user-joined to host,
            // who creates a brand-new connection WITH premierStreamRef tracks.
            if (roomCode) {
                socket.emit('voice:join', { roomCode, passive: true });
                hasJoinedPassivelyRef.current = true;
            }
        };

        socket.on('voice:user-joined', onUserJoined);
        socket.on('voice:offer', onOffer);
        socket.on('voice:answer', onAnswer);
        socket.on('voice:ice-candidate', onIceCandidate);
        socket.on('voice:user-left', onUserLeft);
        socket.on('room:muted', onMutedByHost);
        socket.on('voice:premier-started', onPremierStarted);

        return () => {
            socket.off('voice:user-joined', onUserJoined);
            socket.off('voice:offer', onOffer);
            socket.off('voice:answer', onAnswer);
            socket.off('voice:ice-candidate', onIceCandidate);
            socket.off('voice:user-left', onUserLeft);
            socket.off('room:muted', onMutedByHost);
            socket.off('voice:premier-started', onPremierStarted);
        };
    }, [socket, roomCode, createPeerConnection, closePeer, roomKey]);

    // ── Passive voice join: wait for BOTH socket AND roomKey ─────────────────
    // This is the critical fix for Bug 2: participants couldn't see the live
    // stream video unless they manually toggled voice. The root cause was that
    // joinVoice(true) was called before roomKey was derived (it's async),
    // causing the signaling pool join to happen with a null key. All subsequent
    // WebRTC handshakes would fail silently because encryption requires the key.
    useEffect(() => {
        if (!socket || !roomCode || !roomKey) return;
        // Only perform passive join once per room session
        if (hasJoinedPassivelyRef.current) return;
        hasJoinedPassivelyRef.current = true;
        console.log('[WebRTC] roomKey ready — joining voice signaling pool (passive)');
        joinVoice(true);
    }, [socket, roomCode, roomKey, joinVoice]);

    // Reset passive join flag when leaving a room
    useEffect(() => {
        if (!roomCode) {
            hasJoinedPassivelyRef.current = false;
        }
    }, [roomCode]);

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
