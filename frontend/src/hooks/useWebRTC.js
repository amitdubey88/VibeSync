import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';

/**
 * useWebRTC
 *
 * Full-mesh WebRTC voice chat using native WebRTC APIs (no external library).
 * Signaling is done over Socket.IO.
 *
 * Flow:
 *  1. User clicks "Join Voice" → getUserMedia → emit voice:join
 *  2. Server notifies others → they send RTCPeerConnection offer to new user
 *  3. New user answers → ICE exchange → direct audio stream established
 */
const useWebRTC = () => {
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
    const audioContainerRef = useRef(null);

    const roomCode = room?.code;

    // ── Create a peer connection for a given remote socket ID ─────────────────
    const createPeerConnection = useCallback((remoteSocketId) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });

        // Send ICE candidates to the remote peer via server
        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('voice:ice-candidate', {
                    targetSocketId: remoteSocketId,
                    candidate: event.candidate,
                });
            }
        };

        // When remote stream arrives, handle audio and video tracks
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
                audio.play().catch(err => console.error('[voice] auto-play failed:', err));
            }

            if (event.track.kind === 'video') {
                setRemoteScreens((prev) => ({
                    ...prev,
                    [remoteSocketId]: stream
                }));
            }
        };

        // Add local tracks to the connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current);
            });
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, screenStreamRef.current);
            });
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

    // ── Join voice channel ─────────────────────────────────────────────────────
    const joinVoice = useCallback(async () => {
        if (!socket || !roomCode) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            setIsInVoice(true);
            setVoiceError(null);
            socket.emit('voice:join', { roomCode });
        } catch (err) {
            console.error('[voice] getUserMedia failed:', err);
            setVoiceError('Microphone access denied. Please allow mic permissions.');
        }
    }, [socket, roomCode]);

    // ── Leave voice channel ────────────────────────────────────────────────────
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

    // ── Toggle mute ────────────────────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        if (!localStreamRef.current) return;
        const newMuted = !isMuted;
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
        setIsMuted(newMuted);
        if (socket && roomCode) {
            socket.emit('voice:mute-toggle', { roomCode, isMuted: newMuted });
        }
    }, [isMuted, socket, roomCode]);

    // ── Screen sharing ────────────────────────────────────────────────────────
    const shareScreen = useCallback(async (canShareScreen) => {
        if (!isInVoice) return setVoiceError('Join voice chat first to share screen.');
        if (!canShareScreen) return setVoiceError('You do not have permission to share your screen.');
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            screenStreamRef.current = stream;

            const videoTrack = stream.getVideoTracks()[0];

            // Add track + RENEGOTIATE with every connected peer
            // Without renegotiation the remote side never learns about the new track
            await Promise.all(
                Object.entries(peersRef.current).map(async ([peerId, pc]) => {
                    pc.addTrack(videoTrack, stream);

                    // Trigger renegotiation: create & send a new offer
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    if (socket) {
                        socket.emit('voice:offer', {
                            targetSocketId: peerId,
                            offer,
                            roomCode,
                        });
                    }
                })
            );

            setIsSharingScreen(true);
            setVoiceError(null);

            // Listen for native browser "Stop sharing" button
            videoTrack.addEventListener('ended', () => { stopScreenShareRef.current?.(); }, { once: true });
        } catch (err) {
            console.error('[voice] getDisplayMedia failed:', err);
            if (err.name !== 'NotAllowedError') {
                setVoiceError('Screen share cancelled or denied.');
            }
        }
    }, [isInVoice, socket, roomCode]);

    // Keep a ref so the 'ended' event above can always call the latest version
    const stopScreenShareRef = useRef(null);

    const stopScreenShare = useCallback(async () => {
        if (!screenStreamRef.current) return;

        const videoTrack = screenStreamRef.current.getVideoTracks()[0];
        screenStreamRef.current.getTracks().forEach(t => t.stop());

        // Remove track from each peer + renegotiate so remote side closes the video
        await Promise.all(
            Object.entries(peersRef.current).map(async ([peerId, pc]) => {
                const sender = pc.getSenders().find(s => s.track === videoTrack);
                if (sender) pc.removeTrack(sender);

                // Renegotiate after removal
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    if (socket) {
                        socket.emit('voice:offer', {
                            targetSocketId: peerId,
                            offer,
                            roomCode,
                        });
                    }
                } catch (_) { /* peer may have already disconnected */ }
            })
        );

        screenStreamRef.current = null;
        setIsSharingScreen(false);

        // Clean up remoteScreens entry for our own socket (shouldn't exist, but just in case)
        setRemoteScreens(prev => {
            const next = { ...prev };
            if (socket) delete next[socket.id];
            return next;
        });
    }, [socket, roomCode]);

    // ── Socket signaling events ───────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        // A new peer joined — WE initiate the offer
        const onUserJoined = async ({ socketId }) => {
            if (!localStreamRef.current) return;
            const pc = createPeerConnection(socketId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('voice:offer', { targetSocketId: socketId, offer, roomCode });
        };

        // We received an offer — create answer
        const onOffer = async ({ fromSocketId, offer }) => {
            if (!localStreamRef.current) return;

            // Check if we already have a connection (this means it's a renegotiation)
            let pc = peersRef.current[fromSocketId];
            if (!pc) {
                pc = createPeerConnection(fromSocketId);
            }

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:answer', { targetSocketId: fromSocketId, answer });
        };

        // We received an answer to our offer
        const onAnswer = async ({ fromSocketId, answer }) => {
            const pc = peersRef.current[fromSocketId];
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
        };

        // ICE candidate from remote peer
        const onIceCandidate = async ({ fromSocketId, candidate }) => {
            const pc = peersRef.current[fromSocketId];
            if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
            }
        };

        // Peer left voice
        const onUserLeft = ({ socketId }) => closePeer(socketId);

        // Host muted this user (Mute All) — actually disable the mic track
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

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            Object.keys(peersRef.current).forEach(closePeer);
        };
    }, [closePeer]);

    return {
        isInVoice, isMuted, voiceError,
        joinVoice, leaveVoice, toggleMute,
        isSharingScreen, shareScreen, stopScreenShare,
        remoteScreens
    };
};

export default useWebRTC;
