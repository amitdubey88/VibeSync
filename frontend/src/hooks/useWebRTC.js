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
    const [voiceError, setVoiceError] = useState(null);

    const localStreamRef = useRef(null);
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

        // When remote stream arrives, create an <audio> element to play it
        pc.ontrack = (event) => {
            let audio = document.getElementById(`audio-${remoteSocketId}`);
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = `audio-${remoteSocketId}`;
                audio.autoplay = true;
                audio.playsInline = true;
                document.body.appendChild(audio);
            }
            audio.srcObject = event.streams[0];
        };

        // Add local audio tracks to the connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current);
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
        Object.keys(peersRef.current).forEach(closePeer);
        setIsInVoice(false);
        setIsMuted(false);
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
            const pc = createPeerConnection(fromSocketId);
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

        socket.on('voice:user-joined', onUserJoined);
        socket.on('voice:offer', onOffer);
        socket.on('voice:answer', onAnswer);
        socket.on('voice:ice-candidate', onIceCandidate);
        socket.on('voice:user-left', onUserLeft);

        return () => {
            socket.off('voice:user-joined', onUserJoined);
            socket.off('voice:offer', onOffer);
            socket.off('voice:answer', onAnswer);
            socket.off('voice:ice-candidate', onIceCandidate);
            socket.off('voice:user-left', onUserLeft);
        };
    }, [socket, roomCode, createPeerConnection, closePeer]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            Object.keys(peersRef.current).forEach(closePeer);
        };
    }, [closePeer]);

    return { isInVoice, isMuted, voiceError, joinVoice, leaveVoice, toggleMute };
};

export default useWebRTC;
