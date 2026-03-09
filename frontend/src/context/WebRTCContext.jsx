import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useRoom } from './RoomContext';
import { useAuth } from './AuthContext';
import { encryptData, decryptData } from '../utils/crypto';

const WebRTCContext = createContext();

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export const WebRTCProvider = ({ children }) => {
    const { socket } = useSocket();
    const { room, roomKey } = useRoom();
    const { user } = useAuth();

    // ── Voice state ───────────────────────────────────────────────────────────
    const [isInVoice, setIsInVoice] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [voiceError, setVoiceError] = useState(null);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const localStreamRef    = useRef(null);  // host's mic stream
    const premierStreamRef  = useRef(null);  // host's captureStream (video file)
    const peersRef          = useRef({});    // voice-only RTCPeerConnections
    const videoPeersRef     = useRef({});    // video-stream-only RTCPeerConnections
    const hasJoinedPassivelyRef = useRef(false);
    // Always-current ref for isInVoice — avoids stale closure in createPeerConnection
    const isInVoiceRef = useRef(false);
    useEffect(() => { isInVoiceRef.current = isInVoice; }, [isInVoice]);

    const isHostRef = useRef(false);
    useEffect(() => { isHostRef.current = room?.hostId === user?.id; }, [room?.hostId, user?.id]);

    // ── Remote premier video stream (set when participant receives video) ──────
    const [remotePremierStream, setRemotePremierStream] = useState(null);
    // True from the moment host announces a stream until it ends or host stops.
    // Used by VideoPlayer to show 'Connecting to Feed...' only while host is
    // actively broadcasting (not just because currentVideo.type === 'live').
    const [isStreamAnnounced, setIsStreamAnnounced] = useState(false);

    // Mute/unmute all remote audio elements when voice status changes
    useEffect(() => {
        document.querySelectorAll('audio[data-socket-id]').forEach(a => { a.muted = !isInVoice; });
    }, [isInVoice]);

    const roomCode = room?.code;

    // ═══════════════════════════════════════════════════════════════════════════
    // VOICE peer connections (audio only — mic ↔ mic)
    // ═══════════════════════════════════════════════════════════════════════════

    const createVoicePeerConnection = useCallback((remoteSocketId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = async (event) => {
            if (event.candidate && socket && roomKey) {
                const enc = await encryptData(event.candidate, roomKey);
                socket.emit('voice:ice-candidate', { targetSocketId: remoteSocketId, candidate: enc, e2ee: true });
            }
        };

        pc.ontrack = (event) => {
            // Voice connections only carry audio tracks
            if (event.track.kind !== 'audio') return;
            const stream = event.streams[0];
            setTimeout(() => {
                const audioId = `audio-${remoteSocketId}-${stream.id}`;
                let audio = document.getElementById(audioId);
                if (!audio) {
                    audio = document.createElement('audio');
                    audio.id = audioId;
                    audio.autoplay = true;
                    audio.playsInline = true;
                    audio.dataset.socketId = remoteSocketId;
                    document.body.appendChild(audio);
                }
                audio.srcObject = stream;
                audio.muted = !isInVoiceRef.current;
                
                // Explicitly call play() to handle potential autoplay blocks
                if (!audio.muted) {
                    audio.play().catch(err => console.warn('[Voice] AutoPlay blocked for incoming voice:', err));
                }
            }, 150);
        };

        // Only attach the mic track — NO VIDEO TRACKS on voice connections
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track =>
                pc.addTrack(track, localStreamRef.current)
            );
        }

        peersRef.current[remoteSocketId] = pc;
        return pc;
    }, [socket, roomKey]);

    const closeVoicePeer = useCallback((remoteSocketId) => {
        const pc = peersRef.current[remoteSocketId];
        if (pc) { pc.close(); delete peersRef.current[remoteSocketId]; }
        document.querySelectorAll(`audio[data-socket-id="${remoteSocketId}"]`).forEach(a => a.remove());
    }, []);

    // Alias for backward compatibility with other parts of the code
    const closePeer = closeVoicePeer;

    // ═══════════════════════════════════════════════════════════════════════════
    // VIDEO STREAM peer connections (video only — separate from voice)
    // ═══════════════════════════════════════════════════════════════════════════

    const createVideoPeerConnection = useCallback((remoteSocketId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = async (event) => {
            if (event.candidate && socket && roomKey) {
                const enc = await encryptData(event.candidate, roomKey);
                socket.emit('video-stream:ice', { targetSocketId: remoteSocketId, candidate: enc, e2ee: true });
            }
        };

        pc.ontrack = (event) => {
            // This connection only carries the premier video stream
            const stream = event.streams[0];
            console.log(`[VideoStream] Received ${event.track.kind} track from ${remoteSocketId}`);
            // CRITICAL FIX: WebRTC fires ontrack twice (audio, then video) but passes
            // the exact same MediaStream reference, just mutates it by adding the track.
            // React's setState ignores it because the object reference === the old one.
            // We MUST create a new MediaStream instance so the <video> element re-binds.
            setRemotePremierStream(new MediaStream(stream.getTracks()));
        };

        videoPeersRef.current[remoteSocketId] = pc;
        return pc;
    }, [socket, roomKey]);

    const closeVideoPeer = useCallback((remoteSocketId) => {
        const pc = videoPeersRef.current[remoteSocketId];
        if (pc) { pc.close(); delete videoPeersRef.current[remoteSocketId]; }
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // VOICE API
    // ═══════════════════════════════════════════════════════════════════════════

    const joinVoice = useCallback(async (isPassive = false) => {
        if (!socket || !roomCode) return;
        setVoiceError(null);

        if (isPassive) {
            if (!isInVoiceRef.current) {
                setIsInVoice(true);
                socket.emit('voice:join', { roomCode, passive: true });
            }
            return;
        }

        try {
            // Clean up any existing local stream
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
            }
            
            // Acquire microphone FIRST
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            const audioTrack = stream.getAudioTracks()[0];

            if (isInVoiceRef.current) {
                // We were already in voice passively, and are upgrading to a mic.
                // Add the mic to existing connections and renegotiate.
                if (audioTrack && roomKey) {
                    for (const [targetSocketId, pc] of Object.entries(peersRef.current)) {
                        const senders = pc.getSenders();
                        // Find the existing audio sender
                        const existing = senders.find(s => !s.track || s.track.kind === 'audio');
                        
                        if (existing) {
                            existing.replaceTrack(audioTrack);
                        } else {
                            pc.addTrack(audioTrack, stream);
                        }
                        
                        // Force a renegotiation so the remote peer knows we are sending audio now
                        const transceivers = pc.getTransceivers();
                        const audioTc = transceivers.find(t => t.sender === existing || t.receiver.track.kind === 'audio');
                        if (audioTc) audioTc.direction = 'sendrecv';

                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        const enc = await encryptData(offer, roomKey);
                        socket.emit('voice:offer', { targetSocketId, offer: enc, roomCode, e2ee: true });
                    }
                }
            } else {
                // First time joining voice — tell the room we joined AFTER we have the mic.
                // This guarantees the first WebRTC handshakes will include the audio track.
                setIsInVoice(true);
                socket.emit('voice:join', { roomCode, passive: false });
            }
        } catch (err) {
            console.error('[Voice] Mic access error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setVoiceError('Microphone permission denied. Please enable it in your browser settings.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setVoiceError('No microphone found. You can still listen to others.');
            } else {
                setVoiceError('Could not access microphone. You can still listen without one.');
            }
            // Even if mic fails, they join passively to listen
            if (!isInVoiceRef.current) {
                setIsInVoice(true);
                socket.emit('voice:join', { roomCode, passive: true });
            }
        }
    }, [socket, roomCode, roomKey]);

    const leaveVoice = useCallback(() => {
        if (!socket || !roomCode) return;
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        Object.keys(peersRef.current).forEach(closeVoicePeer);
        setIsInVoice(false);
        setIsMuted(false);
        socket.emit('voice:leave', { roomCode });
    }, [socket, roomCode, closeVoicePeer]);

    const toggleMute = useCallback(async () => {
        if (!localStreamRef.current) {
            await joinVoice(false);
            if (localStreamRef.current) {
                setIsMuted(false);
                if (socket && roomCode) socket.emit('voice:mute-toggle', { roomCode, isMuted: false });
            }
            return;
        }
        const newMuted = !isMuted;
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
        setIsMuted(newMuted);
        if (socket && roomCode) socket.emit('voice:mute-toggle', { roomCode, isMuted: newMuted });
    }, [isMuted, joinVoice, socket, roomCode]);

    // ── Auto-join Passive Voice on Room Entry ────────────────────────────────
    useEffect(() => {
        if (socket && roomCode && !hasJoinedPassivelyRef.current && !isInVoiceRef.current) {
            hasJoinedPassivelyRef.current = true;
            joinVoice(true).catch(console.error);
        }
    }, [socket, roomCode, joinVoice]);

    // ═══════════════════════════════════════════════════════════════════════════
    // LIVE STREAM API (host side)
    // ═══════════════════════════════════════════════════════════════════════════

    const setPremierStream = useCallback((stream) => {
        premierStreamRef.current = stream;
        if (!socket || !roomCode) return;

        if (stream) {
            // Close any stale video peer connections
            Object.keys(videoPeersRef.current).forEach(closeVideoPeer);
            // Announce to ALL room participants — they will send video-stream:offer requests
            socket.emit('video-stream:announce', { roomCode });
            console.log('[VideoStream] Announced live stream to room');
        } else {
            // Stream stopped — close all video connections and notify participants
            Object.keys(videoPeersRef.current).forEach(closeVideoPeer);
            socket.emit('video-stream:ended', { roomCode });
            setRemotePremierStream(null);
        }
    }, [roomCode, socket, closeVideoPeer]);

    // ═══════════════════════════════════════════════════════════════════════════
    // SOCKET EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Voice signaling ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onUserJoined = async ({ socketId }) => {
            if (!roomKey) return;
            const pc = createVoicePeerConnection(socketId);
            // CRITICAL: always declare audio capability in the offer, even without a mic.
            // Without this, an empty offer (no audio m-line) means the answerer (host)
            // cannot inject their mic audio — the SDP negotiation has no audio section at all.
            // Adding a sendrecv transceiver ensures audio can flow in both directions.
            if (!localStreamRef.current) {
                pc.addTransceiver('audio', { direction: 'sendrecv' });
            }
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const enc = await encryptData(offer, roomKey);
            socket.emit('voice:offer', { targetSocketId: socketId, offer: enc, roomCode, e2ee: true });
        };

        const onOffer = async ({ fromSocketId, offer, e2ee }) => {
            if (!roomKey) return;
            const decrypted = e2ee ? await decryptData(offer, roomKey) : offer;
            let pc = peersRef.current[fromSocketId] || createVoicePeerConnection(fromSocketId);
            await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const enc = await encryptData(answer, roomKey);
            socket.emit('voice:answer', { targetSocketId: fromSocketId, answer: enc, e2ee: true });
        };

        const onAnswer = async ({ fromSocketId, answer, e2ee }) => {
            const pc = peersRef.current[fromSocketId];
            if (pc && roomKey) {
                const decrypted = e2ee ? await decryptData(answer, roomKey) : answer;
                await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
            }
        };

        const onIce = async ({ fromSocketId, candidate, e2ee }) => {
            const pc = peersRef.current[fromSocketId];
            if (pc && candidate && roomKey) {
                const decrypted = e2ee ? await decryptData(candidate, roomKey) : candidate;
                await pc.addIceCandidate(new RTCIceCandidate(decrypted)).catch(() => {});
            }
        };

        const onUserLeft   = ({ socketId }) => closeVoicePeer(socketId);
        const onMutedByHost = () => {
            localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
            setIsMuted(true);
        };

        socket.on('voice:user-joined',    onUserJoined);
        socket.on('voice:offer',          onOffer);
        socket.on('voice:answer',         onAnswer);
        socket.on('voice:ice-candidate',  onIce);
        socket.on('voice:user-left',      onUserLeft);
        socket.on('room:muted',           onMutedByHost);

        return () => {
            socket.off('voice:user-joined',   onUserJoined);
            socket.off('voice:offer',         onOffer);
            socket.off('voice:answer',        onAnswer);
            socket.off('voice:ice-candidate', onIce);
            socket.off('voice:user-left',     onUserLeft);
            socket.off('room:muted',          onMutedByHost);
        };
    }, [socket, roomCode, createVoicePeerConnection, closeVoicePeer, roomKey]);

    // ── Video stream signaling (completely separate from voice) ───────────────
    useEffect(() => {
        if (!socket) return;

        // Auto-sync active stream to participants who join late
        const onParticipantUpdate = ({ participants }) => {
            if (!isHostRef.current || !premierStreamRef.current) return;
            participants.forEach(p => {
                if (p.socketId !== socket.id && !videoPeersRef.current[p.socketId]) {
                    console.log(`[VideoStream] Late joiner detected (${p.username}), sending targeted stream announce`);
                    socket.emit('video-stream:announce', { roomCode, targetSocketId: p.socketId });
                    videoPeersRef.current[p.socketId] = 'pending'; // prevent duplicate announcements
                }
            });
        };

        // Participant receives this when the host starts a live stream.
        // Create a video-only peer connection and send an offer to the host.
        const onVideoStreamAnnounced = async ({ hostSocketId }) => {
            if (!roomKey) return;
            console.log('[VideoStream] Host announced stream — connecting for video');
            setIsStreamAnnounced(true); // show 'Connecting to Feed...' on participant side
            closeVideoPeer(hostSocketId);
            const pc = createVideoPeerConnection(hostSocketId);
            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const enc = await encryptData(offer, roomKey);
            socket.emit('video-stream:offer', { targetSocketId: hostSocketId, offer: enc, e2ee: true });
        };

        // Host receives offer from a participant → answer with video stream
        const onVideoStreamOffer = async ({ fromSocketId, offer, e2ee }) => {
            if (!roomKey || !premierStreamRef.current) return;
            const decrypted = e2ee ? await decryptData(offer, roomKey) : offer;
            closeVideoPeer(fromSocketId);
            const pc = createVideoPeerConnection(fromSocketId);
            // Add all video + audio tracks from the premier stream
            premierStreamRef.current.getTracks().forEach(track =>
                pc.addTrack(track, premierStreamRef.current)
            );
            await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const enc = await encryptData(answer, roomKey);
            socket.emit('video-stream:answer', { targetSocketId: fromSocketId, answer: enc, e2ee: true });
            console.log(`[VideoStream] Sent video answer to ${fromSocketId}`);
        };

        const onVideoStreamAnswer = async ({ fromSocketId, answer, e2ee }) => {
            const pc = videoPeersRef.current[fromSocketId];
            if (pc && roomKey) {
                const decrypted = e2ee ? await decryptData(answer, roomKey) : answer;
                await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
            }
        };

        const onVideoStreamIce = async ({ fromSocketId, candidate, e2ee }) => {
            const pc = videoPeersRef.current[fromSocketId];
            if (pc && candidate && roomKey) {
                const decrypted = e2ee ? await decryptData(candidate, roomKey) : candidate;
                await pc.addIceCandidate(new RTCIceCandidate(decrypted)).catch(() => {});
            }
        };

        const onVideoStreamEnded = () => {
            console.log('[VideoStream] Host ended live stream');
            Object.keys(videoPeersRef.current).forEach(closeVideoPeer);
            setRemotePremierStream(null);
            setIsStreamAnnounced(false); // hide Connecting screen
        };

        socket.on('video-stream:announced', onVideoStreamAnnounced);
        socket.on('video-stream:offer',     onVideoStreamOffer);
        socket.on('video-stream:answer',    onVideoStreamAnswer);
        socket.on('video-stream:ice',       onVideoStreamIce);
        socket.on('video-stream:ended',     onVideoStreamEnded);
        socket.on('room:participant-update', onParticipantUpdate);

        return () => {
            socket.off('video-stream:announced', onVideoStreamAnnounced);
            socket.off('video-stream:offer',     onVideoStreamOffer);
            socket.off('video-stream:answer',    onVideoStreamAnswer);
            socket.off('video-stream:ice',       onVideoStreamIce);
            socket.off('video-stream:ended',     onVideoStreamEnded);
            socket.off('room:participant-update', onParticipantUpdate);
        };
    }, [socket, roomCode, roomKey, createVideoPeerConnection, closeVideoPeer]);

    // Reset flags when leaving a room
    useEffect(() => {
        if (!roomCode) {
            hasJoinedPassivelyRef.current = false;
        }
    }, [roomCode]);

    return (
        <WebRTCContext.Provider value={{
            isInVoice, isMuted, voiceError,
            joinVoice, leaveVoice, toggleMute,
            setPremierStream, remotePremierStream, isStreamAnnounced,
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
