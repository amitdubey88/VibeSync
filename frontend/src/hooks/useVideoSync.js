import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import useSyncDataChannel from './useSyncDataChannel';

const DRIFT_THRESHOLD = 3.5; // seconds before enforcing a hard seek

/**
 * useVideoSync
 *
 * Bridges the HTML5 video element ↔ Socket.IO sync events.
 *
 * KEY FIX: we accept a plain `videoEl` DOM element (not a ref) so callers
 * pass `videoRef.current` — this means every time the video element mounts
 * or changes, the hook re-runs its effects with the real DOM node.
 *
 * HOST:   play/pause/seek → emit to server → server broadcasts to guests
 * GUEST:  receive events → seek/play/pause video, with drift correction
 */
const useVideoSync = (videoEl) => {
    const { socket } = useSocket();
    const { room, isHost, setVideoState, currentVideo } = useRoom();
    const { sendSyncMessage, onSyncMessage } = useSyncDataChannel();
    const isSyncingRef = useRef(false);
    const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'catching-up' | 'buffering'
    const roomCode = room?.code;
    // Track source changes to avoid applying stale timing from previous video
    const lastVideoUrlRef = useRef(null);
    const sourceJustChangedRef = useRef(false);

    // Cache the latest sync state if videoEl isn't ready yet
    const cachedSyncStateRef = useRef(null);

    // Detect video source changes so we never apply stale timing from the previous video
    useEffect(() => {
        if (!currentVideo?.url) return;
        if (lastVideoUrlRef.current !== currentVideo.url) {
            lastVideoUrlRef.current = currentVideo.url;
            sourceJustChangedRef.current = true;
            // Clear from changed flag after a reasonable buffer window (3s)
            // by which time the new video's sync-state should have arrived
            const timer = setTimeout(() => { sourceJustChangedRef.current = false; }, 3000);
            return () => clearTimeout(timer);
        }
    }, [currentVideo?.url]);

    // ── Host: emit events ────────────────────────────────────────────────────
    const onHostPlay = useCallback(() => {
        if (!socket || !roomCode) return;
        const currentTime = videoEl?.currentTime || 0;
        sendSyncMessage('video:play', { roomCode, currentTime });
        setVideoState((prev) => ({ ...prev, isPlaying: true, currentTime }));
    }, [socket, roomCode, videoEl, setVideoState, sendSyncMessage]);

    const onHostPause = useCallback(() => {
        if (!socket || !roomCode) return;
        const currentTime = videoEl?.currentTime || 0;
        sendSyncMessage('video:pause', { roomCode, currentTime });
        setVideoState((prev) => ({ ...prev, isPlaying: false, currentTime }));
    }, [socket, roomCode, videoEl, setVideoState, sendSyncMessage]);

    const onHostSeeked = useCallback(() => {
        if (!socket || !roomCode || isSyncingRef.current) return;
        const currentTime = videoEl?.currentTime || 0;
        sendSyncMessage('video:seek', { roomCode, currentTime });
        setVideoState((prev) => ({ ...prev, currentTime }));
    }, [socket, roomCode, videoEl, setVideoState, sendSyncMessage]);

    const onBufferStart = useCallback(() => {
        if (!socket || !roomCode) return;
        socket.emit('video:buffer-start', { roomCode });
    }, [socket, roomCode]);

    const onBufferEnd = useCallback(() => {
        if (!socket || !roomCode) return;
        socket.emit('video:buffer-end', { roomCode });
    }, [socket, roomCode]);

    // ── Attach host event listeners ──────────────────────────────────────────
    // videoEl (not videoRef) is a direct element — this effect re-runs whenever
    // the video element mounts / unmounts / changes.
    useEffect(() => {
        if (!isHost || !videoEl) return;

        videoEl.addEventListener('play', onHostPlay);
        videoEl.addEventListener('pause', onHostPause);
        videoEl.addEventListener('seeked', onHostSeeked);
        videoEl.addEventListener('waiting', onBufferStart);
        videoEl.addEventListener('canplay', onBufferEnd);

        return () => {
            videoEl.removeEventListener('play', onHostPlay);
            videoEl.removeEventListener('pause', onHostPause);
            videoEl.removeEventListener('seeked', onHostSeeked);
            videoEl.removeEventListener('waiting', onBufferStart);
            videoEl.removeEventListener('canplay', onBufferEnd);
        };
    }, [isHost, videoEl, onHostPlay, onHostPause, onHostSeeked, onBufferStart, onBufferEnd]);

    // ── Host: Adaptive Continuous Heartbeat ──────────────────────────────────
    const syncIntervalRef = useRef(4000);
    const driftSamplesRef = useRef([]);

    // 1. Host listens for client drift reports to adapt frequency
    useEffect(() => {
        if (!isHost || !socket) return;
        const onClientDrift = ({ drift }) => {
            const samples = driftSamplesRef.current;
            samples.push(drift);
            if (samples.length > 10) samples.shift(); // Keep last 10 samples

            const avgDrift = samples.reduce((a, b) => a + b, 0) / samples.length;
            
            // Adjust interval conservatively
            if (avgDrift > 1.2) syncIntervalRef.current = 1000;
            else if (avgDrift > 0.5) syncIntervalRef.current = 2500;
            else syncIntervalRef.current = 5000;
        };

        // Listen via Socket.IO (Server routed fallback)
        socket.on('video:client-drift', onClientDrift);

        // Listen via WebRTC DataChannel (Direct P2P)
        const cleanupP2P = onSyncMessage((data) => {
            if (data.type === 'video:drift-report') {
                onClientDrift(data.payload);
            }
        });

        return () => {
            socket.off('video:client-drift', onClientDrift);
            cleanupP2P();
        };
    }, [isHost, socket, onSyncMessage]);

    // 2. Host emits heartbeat using dynamically scaling timeout
    useEffect(() => {
        if (!isHost || !videoEl || !socket || !roomCode) return;
        let timeoutId;

        const sendHeartbeat = () => {
            if (videoEl.readyState >= 1) {
                sendSyncMessage('video:heartbeat', {
                    roomCode,
                    currentTime: videoEl.currentTime,
                    isPlaying: !videoEl.paused,
                    rate: videoEl.playbackRate,
                    timestamp: Date.now() + (window.serverOffset || 0)
                });
            }
            // Queue next heartbeat based on current adaptive interval
            timeoutId = setTimeout(sendHeartbeat, syncIntervalRef.current);
        };

        // Start heartbeat loop
        timeoutId = setTimeout(sendHeartbeat, syncIntervalRef.current);
        return () => clearTimeout(timeoutId);
    }, [isHost, videoEl, socket, roomCode, sendSyncMessage]);

    // ── Guest: receive and apply sync events ──────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const applyTimeIfNeeded = (targetTime) => {
            if (!videoEl) return;
            const drift = Math.abs(targetTime - videoEl.currentTime);
            if (drift > DRIFT_THRESHOLD) {
                isSyncingRef.current = true;
                setSyncStatus('catching-up');
                videoEl.currentTime = targetTime;
                setTimeout(() => { 
                    isSyncingRef.current = false; 
                    setSyncStatus('synced');
                }, 800);
            }
        };

        const onPlay = ({ currentTime }) => {
            if (!videoEl || isHost) return;
            if (currentVideo?.type !== 'live' && currentVideo?.type !== 'uploading') {
                applyTimeIfNeeded(currentTime);
            }
            videoEl.play().catch(() => { });
            setVideoState((prev) => ({ ...prev, isPlaying: true, currentTime }));
        };

        const onPause = ({ currentTime }) => {
            if (!videoEl || isHost) return;
            // For live/upload streams, DO NOT pause the video element.
            // The participant's video element has srcObject from captureStream (WebRTC).
            // Calling .pause() on it causes a black screen — the frozen last frame
            // from the captureStream is the correct 'paused' visual. Just update state.
            if (currentVideo?.type === 'live' || currentVideo?.type === 'uploading') {
                setVideoState((prev) => ({ ...prev, isPlaying: false, currentTime }));
                return;
            }
            videoEl.pause();
            applyTimeIfNeeded(currentTime);
            setVideoState((prev) => ({ ...prev, isPlaying: false, currentTime }));
        };

        const onSeek = ({ currentTime }) => {
            if (!videoEl || isHost) return;
            if (currentVideo?.type !== 'live' && currentVideo?.type !== 'uploading') {
                isSyncingRef.current = true;
                videoEl.currentTime = currentTime;
                setTimeout(() => { isSyncingRef.current = false; }, 300);
            }
            setVideoState((prev) => ({ ...prev, currentTime }));
        };

        const onSyncState = ({ videoState: vs, currentVideo: remoteVideo }) => {
            if (isHost) return;
            
            // Always update videoState duration from server — fix for participants
            // who never load the file locally and thus never get `loadedmetadata`
            if (vs?.duration > 0) {
                setVideoState(prev => prev ? { ...prev, duration: vs.duration } : vs);
            }

            // TIMING FIX: if the source just changed, the server's currentTime is still from
            // the previous video (race between video:source-change and video:sync-state).
            // Skip applying stale currentTime; let the video element start fresh from 0.
            if (sourceJustChangedRef.current) {
                sourceJustChangedRef.current = false;
                return;
            }

            if (!videoEl) {
                // Cache for when element mounts
                cachedSyncStateRef.current = { videoState: vs, currentVideo: remoteVideo };
                return;
            }

            // Bypass drift correction for Live Streams (WebRTC) to prevent flickering
            const videoType = remoteVideo?.type || currentVideo?.type;
            if (videoType === 'live' || videoType === 'uploading') {
                return;
            }

            // Only correct drift if playing to avoid jitter while paused
            if (vs.isPlaying) {
                applyTimeIfNeeded(vs.currentTime);
                if (videoEl.paused) videoEl.play().catch(() => { });
            } else {
                if (!videoEl.paused) videoEl.pause();
                // If paused, we want exact match
                if (Math.abs(videoEl.currentTime - vs.currentTime) > 1.5) {
                    videoEl.currentTime = vs.currentTime;
                }
            }
        };

        const onHeartbeatSync = ({ currentTime, isPlaying, rate = 1, timestamp }) => {
            if (!videoEl || isHost || isSyncingRef.current) return;
            const videoType = currentVideo?.type;
            if (videoType === 'live' || videoType === 'uploading') return;

            // Calculate precisely where the host is *right now* mathematically
            const serverNow = Date.now() + (window.serverOffset || 0);
            const elapsedSecs = (serverNow - timestamp) / 1000;
            const expectedTime = isPlaying ? currentTime + (elapsedSecs * rate) : currentTime;

            const drift = expectedTime - videoEl.currentTime;

            // Enforce pause/play state drift
            if (isPlaying && videoEl.paused) {
                videoEl.play().catch(() => {});
                setVideoState(prev => ({ ...prev, isPlaying: true, currentTime: expectedTime }));
            } else if (!isPlaying && !videoEl.paused) {
                videoEl.pause();
                setVideoState(prev => ({ ...prev, isPlaying: false, currentTime: expectedTime }));
            }

            // Smooth Drift Correction Matrix
            if (Math.abs(drift) > 1.2) {
                // Large drift: Hard jump
                isSyncingRef.current = true;
                setSyncStatus('catching-up');
                videoEl.currentTime = expectedTime;
                setTimeout(() => { 
                    isSyncingRef.current = false; 
                    setSyncStatus('synced');
                }, 800);
            } else if (Math.abs(drift) > 0.3) {
                // Medium drift: Adjust playback rate to scrub gracefully
                videoEl.playbackRate = drift > 0 ? 1.05 : 0.95;
                setSyncStatus('catching-up');
            } else {
                // Synchronized: Restore natural rate
                videoEl.playbackRate = 1.0;
                setSyncStatus('synced');
            }

            // Emit drift telemetry back to host for adaptive sync adjusting
            sendSyncMessage('video:drift-report', { roomCode, drift: Math.abs(drift) });
        };

        // Setup Socket.IO Event Listeners (Fallback path)
        socket.on('video:play', onPlay);
        socket.on('video:pause', onPause);
        socket.on('video:seek', onSeek);
        socket.on('video:sync-state', onSyncState);
        socket.on('video:sync', onHeartbeatSync);

        // Setup WebRTC DataChannel Listeners (P2P Highway path)
        const cleanupDataChannel = onSyncMessage((data) => {
            const { type, payload } = data;
            if (type === 'video:play') onPlay(payload);
            else if (type === 'video:pause') onPause(payload);
            else if (type === 'video:seek') onSeek(payload);
            else if (type === 'video:sync') onHeartbeatSync(payload);
            else if (type === 'video:heartbeat') {
                // If a heartbeat comes P2P directly from the host instead of the server Relay (`video:sync`),
                // we map it identically to the participant's `onHeartbeatSync` function.
                onHeartbeatSync(payload);
            }
        });

        return () => {
            socket.off('video:play', onPlay);
            socket.off('video:pause', onPause);
            socket.off('video:seek', onSeek);
            socket.off('video:sync-state', onSyncState);
            socket.off('video:sync', onHeartbeatSync);
            cleanupDataChannel();
        };
    }, [socket, videoEl, isHost, setVideoState, currentVideo, sendSyncMessage, onSyncMessage]);

    // Apply cached sync state once videoEl becomes available
    useEffect(() => {
        if (videoEl && cachedSyncStateRef.current && !isHost) {
            const { videoState: vs, currentVideo: remoteVideo } = cachedSyncStateRef.current;
            console.log('[useVideoSync] Applying cached sync state to newly mounted video element');
            
            const videoType = remoteVideo?.type || currentVideo?.type;
            if (videoType !== 'live' && videoType !== 'uploading') {
                if (vs.isPlaying) {
                    videoEl.currentTime = vs.currentTime;
                    videoEl.play().catch(() => {});
                } else {
                    videoEl.currentTime = vs.currentTime;
                    videoEl.pause();
                }
            }
            cachedSyncStateRef.current = null;
        }
    }, [videoEl, isHost, currentVideo]);

    // ── Request sync on mount AND after socket reconnect (BUG-12) ────────────
    useEffect(() => {
        if (!socket || !roomCode || isHost) return;

        const requestSync = () => {
            socket.emit('video:request-sync', { roomCode });
        };

        // Request sync on mount / on reconnect (800ms delay to let room:state settle first)
        const timer = setTimeout(requestSync, 800);

        // Re-request sync every time the socket reconnects mid-session
        socket.on('connect', requestSync);

        return () => {
            clearTimeout(timer);
            socket.off('connect', requestSync);
        };
    }, [socket, roomCode, isHost]);

    return { 
        onBufferStart: () => { setSyncStatus('buffering'); onBufferStart(); }, 
        onBufferEnd: () => { setSyncStatus('synced'); onBufferEnd(); },
        syncStatus 
    };
};

export default useVideoSync;
