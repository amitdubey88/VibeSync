/* eslint-disable react-refresh/only-export-components */
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
    const { room, roomKey, currentVideo } = useRoom();
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

    // BUGFIX: Buffer the hostSocketId when video-stream:announced arrives before
    // roomKey is derived. A useEffect below retries the connection once roomKey
    // becomes available, preventing a silent no-op due to the early return.
    const pendingStreamHostRef = useRef(null);

    // BUG2 FIX: Track which remote IDs have a negotiation in-flight to prevent
    // duplicate peer connections during rapid video switches.
    const negotiatingRef = useRef({}); // { [socketId]: true | undefined }

    // Guard: true while participant is actively mid-WebRTC-handshake for the incoming stream.
    // Prevents onVideoStreamEnded (from a fast video-switch) from clearing the stream
    // while a new connection is already in progress.
    const isConnectingRef = useRef(false);

    // Mute/unmute all remote audio elements when voice status changes
    useEffect(() => {
        document.querySelectorAll('audio[data-socket-id]').forEach(a => { a.muted = !isInVoice; });
    }, [isInVoice]);

    const roomCode = room?.code;

    // ── Active Speaker Detection (Web Audio API) ───────────────────────────────
    const analysersRef = useRef(new Map());
    const audioContextRef = useRef(null);
    const activeSpeakersRef = useRef(new Set());

    const initAudioContext = () => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioContextRef.current = new AudioContextClass();
            }
        }
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    };

    const setupVolumeDetection = useCallback((streamId, stream) => {
        try {
            const ctx = initAudioContext();
            if (!ctx) return;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.4;
            // No destination connection — we only analyze. <audio> handles playback.
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analysersRef.current.set(streamId, { analyser, dataArray, stream, source });
        } catch (e) {
            console.warn(`[Voice] Volume setup failed for ${streamId}:`, e);
        }
    }, []);

    const teardownVolumeDetection = useCallback((streamId) => {
        const item = analysersRef.current.get(streamId);
        if (item) {
            try { item.analyser.disconnect(); } catch { /* ignore */ }
            try { item.source.disconnect(); } catch { /* ignore */ }
            analysersRef.current.delete(streamId);
        }
    }, []);

    // 100ms interval polling to dispatch speaker status to UI overlays
    useEffect(() => {
        const analyzeVolumes = () => {
            const currentSpeakers = new Set();
            for (const [id, { analyser, dataArray }] of analysersRef.current.entries()) {
                // Skip local user evaluation if they are currently muted
                if (id === 'local' && isMuted) continue;

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const average = sum / dataArray.length;
                
                if (average > 15) { // Threshold for "speaking"
                    currentSpeakers.add(id);
                }
            }
            
            const oldSet = activeSpeakersRef.current;
            let changed = currentSpeakers.size !== oldSet.size;
            if (!changed) {
                for (const item of currentSpeakers) {
                    if (!oldSet.has(item)) { changed = true; break; }
                }
            }
            
            if (changed) {
                activeSpeakersRef.current = currentSpeakers;
                window.dispatchEvent(new CustomEvent('voice:active-speakers', { detail: Array.from(currentSpeakers) }));
            }
        };
        const interval = setInterval(analyzeVolumes, 100);
        return () => clearInterval(interval);
    }, [isMuted]);


    // ═══════════════════════════════════════════════════════════════════════════
    // VOICE peer connections (audio only — mic ↔ mic)
    // ═══════════════════════════════════════════════════════════════════════════

    const createVoicePeerConnection = useCallback((remoteSocketId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        // Set to true by caller when they initiate the offer (prevents both sides re-offering on ICE restart)
        pc._isOfferer = false;

        pc.onicecandidate = async (event) => {
            if (event.candidate && socket && roomKey) {
                const enc = await encryptData(event.candidate, roomKey);
                socket.emit('voice:ice-candidate', { targetSocketId: remoteSocketId, candidate: enc, e2ee: true });
            }
        };

        pc.ontrack = (event) => {
            // Voice connections only carry audio tracks
            if (event.track.kind !== 'audio') return;
            
            // If the track isn't associated with a stream (e.g. upgraded transceivers), wrap it.
            const stream = event.streams && event.streams.length > 0 
                ? event.streams[0] 
                : new MediaStream([event.track]);

            // Minimal delay (50ms) lets the browser finish binding the track to the stream
            // before we attach it to an <audio> element. 0ms can cause silent playback.
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
                
                setupVolumeDetection(remoteSocketId, stream);
                
                // Explicitly call play() to handle potential autoplay blocks
                if (!audio.muted) {
                    audio.play().catch(err => console.warn('[Voice] AutoPlay blocked for incoming voice:', err));
                }
            }, 50);
        };

        // ICE restart: only the offerer re-creates the offer so only one side drives recovery
        pc.onnegotiationneeded = async () => {
            if (!pc._isOfferer || !socket || !roomKey) return;
            if (pc.signalingState !== 'stable') return;
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const enc = await encryptData(offer, roomKey);
                socket.emit('voice:offer', { targetSocketId: remoteSocketId, offer: enc, roomCode, e2ee: true });
            } catch (e) {
                console.warn('[Voice] ICE restart offer failed:', e);
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            if (state === 'failed') {
                console.warn(`[Voice] ICE failed for ${remoteSocketId}, attempting restart...`);
                pc.restartIce?.();
            }
        };

        // Only attach the mic track — NO VIDEO TRACKS on voice connections
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track =>
                pc.addTrack(track, localStreamRef.current)
            );
        }

        peersRef.current[remoteSocketId] = pc;
        return pc;
    }, [socket, roomKey, roomCode, setupVolumeDetection]);

    const closeVoicePeer = useCallback((remoteSocketId) => {
        const pc = peersRef.current[remoteSocketId];
        if (pc && typeof pc.close === 'function') pc.close();
        delete peersRef.current[remoteSocketId];
        document.querySelectorAll(`audio[data-socket-id="${remoteSocketId}"]`).forEach(a => a.remove());
        teardownVolumeDetection(remoteSocketId);
    }, [teardownVolumeDetection]);

    // (closePeer alias removed — was unused duplicate of closeVoicePeer)

    // ═══════════════════════════════════════════════════════════════════════════
    // VIDEO STREAM peer connections (video only — separate from voice)
    // ═══════════════════════════════════════════════════════════════════════════

    const createVideoPeerConnection = useCallback((remoteSocketId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // FIX1: Flag to suppress onnegotiationneeded when we create offers explicitly.
        // addTransceiver() triggers onnegotiationneeded automatically, but we already
        // call createOffer() ourselves in onVideoStreamAnnounced. Without this guard,
        // a SECOND offer fires on the same PC, causing:
        //   "m-lines order in subsequent offer doesn't match order from previous offer/answer"
        pc._suppressNegotiation = true;

        pc.onicecandidate = async (event) => {
            if (event.candidate && socket && roomKey) {
                const enc = await encryptData(event.candidate, roomKey);
                socket.emit('video-stream:ice', { targetSocketId: remoteSocketId, candidate: enc, e2ee: true });
            }
        };

        // TRACK RECEIVED — debounce so both tracks (video+audio) arrive before committing.
        // Reduced to 50ms: only matters for initial connection. replaceTrack() doesn't fire ontrack.
        let trackDebounceTimer = null;
        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (!stream) return;
            console.log(`[VideoStream] Received ${event.track.kind} track from ${remoteSocketId}. Total tracks: ${stream.getTracks().length}`);
            clearTimeout(trackDebounceTimer);
            trackDebounceTimer = setTimeout(() => {
                // Only update if this PC is still the active one for this peer
                if (videoPeersRef.current[remoteSocketId] !== pc) return;
                isConnectingRef.current = false; // Connection delivered — safe for ended events to clear
                setRemotePremierStream(prev => {
                    if (prev) prev.getTracks().forEach(t => t.stop());
                    return new MediaStream(stream.getTracks());
                });
            }, 50);
        };

        // Only send ICE-restart offers when NOT suppressed (i.e. initial negotiation has
        // already completed and the connection later fails mid-session).
        pc.onnegotiationneeded = async () => {
            if (pc._suppressNegotiation) return; // explicit offer in progress — skip
            if (premierStreamRef.current || !socket || !roomKey) return;
            if (pc.signalingState !== 'stable') return;
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const enc = await encryptData(offer, roomKey);
                socket.emit('video-stream:offer', { targetSocketId: remoteSocketId, offer: enc, e2ee: true });
                console.log(`[VideoStream] ICE restart offer sent to ${remoteSocketId}`);
            } catch (e) {
                console.warn('[VideoStream] ICE restart offer failed:', e);
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            if (state === 'failed') {
                console.warn(`[VideoStream] ICE failed for ${remoteSocketId}, attempting restart...`);
                pc.restartIce?.();
            }
        };

        videoPeersRef.current[remoteSocketId] = pc;
        return pc;
    }, [socket, roomKey]);

    const closeVideoPeer = useCallback((remoteSocketId) => {
        const pc = videoPeersRef.current[remoteSocketId];
        if (pc && typeof pc.close === 'function') pc.close();
        delete videoPeersRef.current[remoteSocketId];
        delete negotiatingRef.current[remoteSocketId];
    }, []);

    // ── replaceTrack helper: hot-swap tracks on ALL existing video PCs ────────
    // Uses RTCRtpSender.replaceTrack() — no renegotiation, no ICE restart.
    // Returns true if at least one PC was updated, false if no PCs exist.
    const replaceTracksOnAllPeers = useCallback((newStream) => {
        const peerEntries = Object.entries(videoPeersRef.current);
        // Filter to only real RTCPeerConnection objects (not 'pending' strings)
        const activePeers = peerEntries.filter(([, pc]) => pc && typeof pc.getSenders === 'function');
        if (activePeers.length === 0) return false;

        const newVideoTrack = newStream.getVideoTracks()[0] || null;
        const newAudioTrack = newStream.getAudioTracks()[0] || null;

        activePeers.forEach(([socketId, pc]) => {
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video' || (!s.track && s._kind === 'video'));
            const audioSender = senders.find(s => s.track?.kind === 'audio' || (!s.track && s._kind === 'audio'));

            if (videoSender && newVideoTrack) {
                videoSender.replaceTrack(newVideoTrack).catch(err =>
                    console.warn(`[VideoStream] replaceTrack(video) failed for ${socketId}:`, err)
                );
            }
            if (audioSender && newAudioTrack) {
                audioSender.replaceTrack(newAudioTrack).catch(err =>
                    console.warn(`[VideoStream] replaceTrack(audio) failed for ${socketId}:`, err)
                );
            }
        });

        console.log(`[VideoStream] Replaced tracks on ${activePeers.length} peer(s) — no renegotiation`);
        return true;
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
                teardownVolumeDetection('local');
            }
            
            // Acquire microphone FIRST
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            const audioTrack = stream.getAudioTracks()[0];
            setupVolumeDetection('local', stream);

            if (isInVoiceRef.current) {
                // We were already in voice passively, and are upgrading to a mic.
                // Add the mic to existing connections and renegotiate.
                if (audioTrack && roomKey) {
                    for (const [targetSocketId, pc] of Object.entries(peersRef.current)) {
                        const senders = pc.getSenders();
                        // Find an existing audio sender (with or without a track)
                        const existing = senders.find(s => !s.track || s.track.kind === 'audio');
                        
                        if (existing) {
                            await existing.replaceTrack(audioTrack);
                        } else {
                            pc.addTrack(audioTrack, stream);
                        }
                        
                        // Force sendrecv on the audio transceiver.
                        // BUGFIX: t.receiver.track can be null before remote track arrives,
                        // so we must null-check it before accessing .kind.
                        const audioTc = pc.getTransceivers().find(t =>
                            t.sender.track?.kind === 'audio' ||
                            (t.receiver.track && t.receiver.track.kind === 'audio')
                        );
                        if (audioTc && audioTc.direction !== 'sendrecv') {
                            audioTc.direction = 'sendrecv';
                        }

                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        const enc = await encryptData(offer, roomKey);
                        socket.emit('voice:offer', { targetSocketId, offer: enc, roomCode, e2ee: true });
                    }
                }
                // BUGFIX: Mark as unmuted after successfully acquiring mic
                setIsMuted(false);
                if (socket && roomCode) socket.emit('voice:mute-toggle', { roomCode, isMuted: false });
            } else {
                // First time joining voice — tell the room we joined AFTER we have the mic.
                // This guarantees the first WebRTC handshakes will include the audio track.
                setIsInVoice(true);
                setIsMuted(false);
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
    }, [socket, roomCode, roomKey, setupVolumeDetection, teardownVolumeDetection]);

    const leaveVoice = useCallback(() => {
        if (!socket || !roomCode) return;
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        teardownVolumeDetection('local');
        Object.keys(peersRef.current).forEach(closeVoicePeer);
        setIsInVoice(false);
        // BUGFIX: Reset to true (muted) so next join starts in correct muted state
        setIsMuted(true);
        socket.emit('voice:leave', { roomCode });
    }, [socket, roomCode, closeVoicePeer, teardownVolumeDetection]);

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

    // FIX: Reset passive-join guard when socket reconnects (gets a new instance).
    // Without this, hasJoinedPassivelyRef stays 'true' from the previous connection
    // and the user silently misses re-joining voice + requesting the live stream.
    useEffect(() => {
        hasJoinedPassivelyRef.current = false;
    }, [socket]);

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
        const oldStream = premierStreamRef.current;
        premierStreamRef.current = stream;
        if (!socket || !roomCode) return;

        if (stream) {
            // ── SEAMLESS SWITCH: If we already have active peer connections, hot-swap
            //    tracks instead of tearing down + re-announcing. This keeps ICE+DTLS
            //    alive and swaps media content in-place — zero interruption.
            const didReplace = replaceTracksOnAllPeers(stream);

            if (didReplace) {
                // Stop old tracks to free hardware resources
                if (oldStream && oldStream !== stream) {
                    oldStream.getTracks().forEach(t => t.stop());
                }
                // Notify participants so they can force play() if video element stalled
                socket.emit('video-stream:tracks-replaced', { roomCode });
                console.log('[VideoStream] Tracks replaced on existing peers — no renegotiation needed');
            } else {
                // No existing peers — do a full announce (first-time setup or all PCs disconnected)
                Object.keys(videoPeersRef.current).forEach(closeVideoPeer);
                socket.emit('video-stream:announce', { roomCode });
                console.log('[VideoStream] Announced live stream to room (no existing peers to replace)');
            }
        } else {
            console.log('[VideoStream] Stopping live stream.');
            // Stop old tracks
            if (oldStream) {
                oldStream.getTracks().forEach(t => t.stop());
            }
            Object.keys(videoPeersRef.current).forEach(closeVideoPeer);
            socket.emit('video-stream:ended', { roomCode });
            setRemotePremierStream(null);
        }
    }, [roomCode, socket, closeVideoPeer, replaceTracksOnAllPeers]);

    // ── Stream state reset (called by useHostTransferSync on host change) ────
    const resetStreamState = useCallback(() => {
        Object.keys(videoPeersRef.current).forEach(closeVideoPeer);
        setRemotePremierStream(null);
        setIsStreamAnnounced(false);
    }, [closeVideoPeer]);

    // ═══════════════════════════════════════════════════════════════════════════
    // SOCKET EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Voice signaling ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onUserJoined = async ({ socketId }) => {
            if (!roomKey) return;
            const pc = createVoicePeerConnection(socketId);
            // Mark this side as the offerer so ICE restart logic knows who re-sends the offer
            pc._isOfferer = true;
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
            try {
                const decrypted = e2ee ? await decryptData(offer, roomKey) : offer;
                // Always close & recreate the PC so the current mic track is attached.
                // Without this, reused PCs from passive joins won't have the host's audio.
                closeVoicePeer(fromSocketId);
                const pc = createVoicePeerConnection(fromSocketId);
                await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                const enc = await encryptData(answer, roomKey);
                socket.emit('voice:answer', { targetSocketId: fromSocketId, answer: enc, e2ee: true });
            } catch (err) {
                console.warn(`[Voice] Failed to handle offer from ${fromSocketId}:`, err.name);
            }
        };

        const onAnswer = async ({ fromSocketId, answer, e2ee }) => {
            const pc = peersRef.current[fromSocketId];
            if (!pc || !roomKey) return;
            try {
                const decrypted = e2ee ? await decryptData(answer, roomKey) : answer;
                await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
            } catch (err) {
                console.warn(`[Voice] setRemoteDescription failed for ${fromSocketId}:`, err.name);
            }
        };

        const onIce = async ({ fromSocketId, candidate, e2ee }) => {
            const pc = peersRef.current[fromSocketId];
            if (!pc || !candidate || !roomKey) return;
            try {
                const decrypted = e2ee ? await decryptData(candidate, roomKey) : candidate;
                await pc.addIceCandidate(new RTCIceCandidate(decrypted)).catch(() => {});
            } catch (err) {
                // Stale ICE candidates from replaced connections are expected — ignore
                if (err.name !== 'OperationError') console.warn(`[Voice] ICE error for ${fromSocketId}:`, err.name);
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

        // Auto-sync active stream to participants who join late or rejoin with a new socket ID
        const onParticipantUpdate = ({ participants }) => {
            if (!premierStreamRef.current) return;
            // stale 'pending' entries whose participant has since disconnected/rejoined.
            // A rejoined participant gets a NEW socketId — the old entry blocks re-announce.
            const liveSocketIds = new Set(participants.map(p => p.socketId));
            Object.keys(videoPeersRef.current).forEach(sid => {
                if (!liveSocketIds.has(sid)) closeVideoPeer(sid);
            });

            participants.forEach(p => {
                if (p.socketId === socket.id) return; // skip self
                if (!p.isOnline) return;              // skip grace-period-offline participants
                if (!videoPeersRef.current[p.socketId]) {
                    console.log(`[VideoStream] Announcing stream to ${p.username} (${p.socketId})`);
                    socket.emit('video-stream:announce', { roomCode, targetSocketId: p.socketId });
                    videoPeersRef.current[p.socketId] = 'pending';
                }
            });
        };

        // Fallback: a late-joining participant explicitly asks for the stream
        const onRequestAnnounce = ({ fromSocketId }) => {
            if (!premierStreamRef.current) return;
            console.log(`[VideoStream] Participant ${fromSocketId} requested stream announce`);
            socket.emit('video-stream:announce', { roomCode, targetSocketId: fromSocketId });
            videoPeersRef.current[fromSocketId] = 'pending';
        };

        // Participant receives this when the host starts a live stream.
        const onVideoStreamAnnounced = async ({ hostSocketId }) => {
            console.log(`[VideoStream] Host ${hostSocketId} announced a live stream. Attempting to connect...`);
            setIsStreamAnnounced(true);

            // Skip duplicate announce if negotiation already in-flight for this host.
            if (negotiatingRef.current[hostSocketId]) {
                console.warn('[VideoStream] Negotiation already in-progress — skipping duplicate announce');
                return;
            }

            if (!roomKey) {
                console.warn('[VideoStream] roomKey not ready — buffering announce for retry');
                pendingStreamHostRef.current = hostSocketId;
                return;
            }

            negotiatingRef.current[hostSocketId] = true;
            isConnectingRef.current = true;  // Mark as connecting so stream-ended events don't clear prematurely
            // Keep old stream alive until ontrack fires with the new one.
            closeVideoPeer(hostSocketId);
            try {
                const pc = createVideoPeerConnection(hostSocketId);
                // pc._suppressNegotiation = true already — addTransceiver won't fire a second offer
                pc.addTransceiver('video', { direction: 'recvonly' });
                pc.addTransceiver('audio', { direction: 'recvonly' });
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                // After our explicit offer is sent, allow onnegotiationneeded for ICE restarts later
                pc._suppressNegotiation = false;
                const enc = await encryptData(offer, roomKey);
                socket.emit('video-stream:offer', { targetSocketId: hostSocketId, offer: enc, e2ee: true });
                console.log('[VideoStream] Sent video-stream:offer to host.');
            } catch (err) {
                console.error('[VideoStream] Failed to create offer:', err);
                isConnectingRef.current = false;
            } finally {
                delete negotiatingRef.current[hostSocketId];
                // Note: isConnectingRef stays true until ontrack fires and delivers the stream.
                // It is reset by onVideoStreamEnded if that event arrives while NOT connecting.
            }
        };

        // Host receives offer from a participant → answer with video stream.
        // FIX2: Removed the replaceStreamOnPeer fast-path that was causing
        //   "setRemoteDescription called in wrong state: stable" errors.
        // The fast-path tried to both replaceTrack AND renegotiate SDP on the same PC,
        // leaving the signaling state machine in an inconsistent 'stable' state before
        // onVideoStreamAnswer tried to apply the new answer. Full teardown + rebuild
        // (below) is clean and avoids all state-machine conflicts.
        const onVideoStreamOffer = async ({ fromSocketId, offer, e2ee }) => {
            if (!roomKey) return;
            if (!premierStreamRef.current) {
                console.warn(`[VideoStream] No active stream to send to ${fromSocketId} — ignoring offer`);
                return;
            }
            try {
                const decrypted = e2ee ? await decryptData(offer, roomKey) : offer;
                // Always close the old PC and create a fresh one.
                // This ensures the host's answer always targets the participant's current offer
                // and the SDP state machine starts from a clean slate.
                closeVideoPeer(fromSocketId);
                const pc = createVideoPeerConnection(fromSocketId);
                // Suppress onnegotiationneeded on host-side PCs (host never sends offers)
                pc._suppressNegotiation = true;
                
                premierStreamRef.current.getTracks().forEach(track => {
                    const sender = pc.addTrack(track, premierStreamRef.current);
                    
                    // Boost video quality: WebRTC often defaults to low bitrates for capture streams (1-2 Mbps)
                    // Force the encoder to allow up to 8 Mbps for high-quality live streaming
                    if (track.kind === 'video') {
                        const params = sender.getParameters();
                        if (!params.encodings) params.encodings = [{}];
                        params.encodings[0].maxBitrate = 8000000; // 8 Mbps
                        sender.setParameters(params).catch(e => console.warn('[VideoStream] Failed to set high bitrate:', e));
                    }
                });

                await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                const enc = await encryptData(answer, roomKey);
                socket.emit('video-stream:answer', { targetSocketId: fromSocketId, answer: enc, e2ee: true });
                console.log(`[VideoStream] Sent video answer to ${fromSocketId}`);
            } catch (err) {
                console.error(`[VideoStream] Failed to answer offer from ${fromSocketId}:`, err);
            }
        };

        const onVideoStreamAnswer = async ({ fromSocketId, answer, e2ee }) => {
            const pc = videoPeersRef.current[fromSocketId];
            if (!pc || !roomKey) return;
            // Guard: if the PC is not in have-local-offer state, the answer is stale.
            // 'stable' means we already completed a handshake (e.g. from onParticipantUpdate
            // sending announce that arrived first). 'closed' means the PC was replaced.
            // We do NOT guard against 'have-remote-offer' since that shouldn't happen participant-side.
            if (pc.signalingState !== 'have-local-offer') {
                console.warn(`[VideoStream] Dropping answer from ${fromSocketId} — signalingState: ${pc.signalingState}`);
                return;
            }
            try {
                const decrypted = e2ee ? await decryptData(answer, roomKey) : answer;
                await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
                console.log(`[VideoStream] Answer accepted from ${fromSocketId} — connection established`);
            } catch (err) {
                console.warn(`[VideoStream] setRemoteDescription failed for ${fromSocketId}:`, err);
            }
        };

        const onVideoStreamIce = async ({ fromSocketId, candidate, e2ee }) => {
            const pc = videoPeersRef.current[fromSocketId];
            if (!pc || !candidate || !roomKey) return;
            try {
                const decrypted = e2ee ? await decryptData(candidate, roomKey) : candidate;
                await pc.addIceCandidate(new RTCIceCandidate(decrypted)).catch(() => {});
            } catch (err) {
                // Stale ICE candidates for a closed/replaced PC are expected — silently ignore
                if (err.name !== 'OperationError') console.warn(`[VideoStream] ICE error for ${fromSocketId}:`, err.name);
            }
        };

        const onVideoStreamEnded = () => {
            console.log('[VideoStream] Host ended live stream');
            Object.keys(videoPeersRef.current).forEach(closeVideoPeer);
            if (!isConnectingRef.current) {
                setRemotePremierStream(null);
                setIsStreamAnnounced(false);
            } else {
                console.log('[VideoStream] Reconnect already in-progress — skipping stream clear on ended');
            }
        };

        // Participant receives this when host used replaceTrack() (seamless switch).
        // The existing track objects continue receiving new media automatically —
        // this event is just a nudge to force play() if the video element paused.
        const onTracksReplaced = () => {
            console.log('[VideoStream] Host replaced tracks — nudging playback');
            // Dispatch event for UI overlays to know swap is complete
            window.dispatchEvent(new CustomEvent('video-stream:tracks-replaced'));

            const videoEl = watchdogVideoRef.current;
            if (videoEl && videoEl.paused) {
                videoEl.play().catch(err => {
                    if (err.name === 'AbortError') return;
                    console.warn('[VideoStream] play() after tracks-replaced failed:', err);
                    videoEl.muted = true;
                    videoEl.play().catch(() => {});
                });
            }
        };

        socket.on('video-stream:announced', onVideoStreamAnnounced);
        socket.on('video-stream:offer',     onVideoStreamOffer);
        socket.on('video-stream:answer',    onVideoStreamAnswer);
        socket.on('video-stream:ice',       onVideoStreamIce);
        socket.on('video-stream:ended',     onVideoStreamEnded);
        socket.on('video-stream:tracks-replaced', onTracksReplaced);
        socket.on('room:participant-update', onParticipantUpdate);
        socket.on('video-stream:request-announce', onRequestAnnounce);

        return () => {
            socket.off('video-stream:announced', onVideoStreamAnnounced);
            socket.off('video-stream:offer',     onVideoStreamOffer);
            socket.off('video-stream:answer',    onVideoStreamAnswer);
            socket.off('video-stream:ice',       onVideoStreamIce);
            socket.off('video-stream:ended',     onVideoStreamEnded);
            socket.off('video-stream:tracks-replaced', onTracksReplaced);
            socket.off('room:participant-update', onParticipantUpdate);
            socket.off('video-stream:request-announce', onRequestAnnounce);
        };
    }, [socket, roomCode, roomKey, createVideoPeerConnection, closeVideoPeer]);

    // BUGFIX: Retry pending stream connection once roomKey becomes available.
    // This handles the race where video-stream:announced fires before deriveKey()
    // completes — onVideoStreamAnnounced buffers the hostSocketId and this effect
    // completes the WebRTC handshake as soon as RoomContext provides the key.
    useEffect(() => {
        if (!roomKey || !socket || premierStreamRef.current) return;
        const hostSocketId = pendingStreamHostRef.current;
        if (!hostSocketId) return;
        pendingStreamHostRef.current = null; // consume

        console.log('[VideoStream] Retrying buffered announce with roomKey now available');
        (async () => {
            try {
                closeVideoPeer(hostSocketId);
                const pc = createVideoPeerConnection(hostSocketId);
                pc.addTransceiver('video', { direction: 'recvonly' });
                pc.addTransceiver('audio', { direction: 'recvonly' });
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const enc = await encryptData(offer, roomKey);
                socket.emit('video-stream:offer', { targetSocketId: hostSocketId, offer: enc, e2ee: true });
            } catch (e) {
                console.error('[VideoStream] Retry failed:', e);
            }
        })();
    }, [roomKey, socket, closeVideoPeer, createVideoPeerConnection]);

    // Late-joiner / refresh fix: if participant detects a live stream type but hasn't
    // received the video feed yet, request an announce from the host.
    // TIMING: Wait 1.5s before first attempt so onParticipantUpdate-triggered announce
    // (sent by host immediately on participant join) has time to arrive and start the
    // WebRTC handshake first. If we fire immediately, both paths run in parallel and
    // negotiatingRef blocks the second one — leaving no active connection attempt.
    useEffect(() => {
        if (!socket || !roomCode || premierStreamRef.current) return;
        if (currentVideo?.type !== 'live') return;
        if (isHostRef.current) return; // Host is the broadcaster — never connects to their own stream
        if (remotePremierStream) return; // already receiving stream, nothing to do

        // Show connecting overlay immediately (don't wait for video-stream:announced
        // which won't arrive on refresh since it's a one-time broadcast)
        setIsStreamAnnounced(true);

        let attempt = 0;
        const maxAttempts = 5;

        const tryRequest = () => {
            // Skip if stream was already received between retries
            if (remotePremierStream) return;
            attempt++;
            console.log(`[VideoStream] Late joiner requesting stream (attempt ${attempt}/${maxAttempts})`);
            socket.emit('video-stream:request-announce', { roomCode });
        };

        // Delay first attempt 1.5s to give host's onParticipantUpdate announce a head start.
        // Subsequent retries use exponential backoff.
        const retryDelays = [1500, 3500, 6000, 10000];
        const retryTimers = retryDelays.slice(0, maxAttempts).map((delay) =>
            setTimeout(tryRequest, delay)
        );

        return () => {
            retryTimers.forEach(clearTimeout);
        };
    }, [socket, roomCode, currentVideo?.type, remotePremierStream]);

    // Also clear isConnectingRef when stream actually becomes null externally
    // (e.g. host ended stream and no new connection is coming)
    useEffect(() => {
        if (!remotePremierStream) {
            // Give 3s grace in case a new announce is in-flight, then clean up
            const t = setTimeout(() => { isConnectingRef.current = false; }, 3000);
            return () => clearTimeout(t);
        }
    }, [remotePremierStream]);

    // BUG5 FIX: Mid-session watchdog — if the participant has a stream but the video
    // element stalls (readyState < 2) for 4 consecutive seconds, auto-request recovery.
    // This handles silent ICE failures and the case where replaceTrack doesn't fire
    // ontrack again after a host video switch.
    // NOTE: We intentionally do NOT check videoEl.paused — WebRTC live-streams can
    // transiently pause during track replacement, so checking paused would cause
    // unnecessary reconnect loops.
    const watchdogVideoRef = useRef(null); // registered by VideoPlayer when live <video> mounts
    useEffect(() => {
        if (!socket || !roomCode || premierStreamRef.current) return;
        if (!remotePremierStream) return;

        let staleTicks = 0;
        const STALE_THRESHOLD = 4;   // 4 consecutive 1s ticks = 4s before recovery
        const GRACE_PERIOD_MS = 5000; // allow initial WebRTC handshake to complete

        // Local timer IDs — no need for a class-level ref since cleanup captures them
        let watchdogInterval = null;

        const startWatchdog = () => {
            watchdogInterval = setInterval(() => {
                const videoEl = watchdogVideoRef.current;
                if (!videoEl) return;

                // Only count as stale if readyState is low AND video is not intentionally paused.
                // readyState < 2 during a normal pause is expected and not a stream failure.
                const isStalled = videoEl.readyState < 2 && !videoEl.paused;
                if (isStalled) {
                    staleTicks++;
                    if (staleTicks >= STALE_THRESHOLD) {
                        console.warn('[VideoStream] Watchdog: stream stalled — requesting recovery...');
                        staleTicks = 0;
                        socket.emit('video-stream:request-announce', { roomCode });
                    }
                } else {
                    staleTicks = 0;
                }
            }, 1000);
        };

        const graceTimer = setTimeout(startWatchdog, GRACE_PERIOD_MS);

        return () => {
            clearTimeout(graceTimer);
            if (watchdogInterval) clearInterval(watchdogInterval);
        };
    }, [socket, roomCode, remotePremierStream]);

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
            setPremierStream, remotePremierStream, isStreamAnnounced, resetStreamState,
            // Expose watchdog ref so VideoPlayer can register the live <video> element
            watchdogVideoRef,
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
