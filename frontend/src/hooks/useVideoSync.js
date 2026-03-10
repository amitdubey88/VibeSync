import { useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

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
    const isSyncingRef = useRef(false);
    const roomCode = room?.code;

    // ── Host: emit events ────────────────────────────────────────────────────
    const onHostPlay = useCallback(() => {
        if (!socket || !roomCode) return;
        const currentTime = videoEl?.currentTime || 0;
        socket.emit('video:play', { roomCode, currentTime });
        setVideoState((prev) => ({ ...prev, isPlaying: true, currentTime }));
    }, [socket, roomCode, videoEl, setVideoState]);

    const onHostPause = useCallback(() => {
        if (!socket || !roomCode) return;
        const currentTime = videoEl?.currentTime || 0;
        socket.emit('video:pause', { roomCode, currentTime });
        setVideoState((prev) => ({ ...prev, isPlaying: false, currentTime }));
    }, [socket, roomCode, videoEl, setVideoState]);

    const onHostSeeked = useCallback(() => {
        if (!socket || !roomCode || isSyncingRef.current) return;
        const currentTime = videoEl?.currentTime || 0;
        socket.emit('video:seek', { roomCode, currentTime });
        setVideoState((prev) => ({ ...prev, currentTime }));
    }, [socket, roomCode, videoEl, setVideoState]);

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

    // ── Host: Continuous Heartbeat ───────────────────────────────────────────
    useEffect(() => {
        if (!isHost || !videoEl || !socket || !roomCode) return;

        const heartbeatInterval = setInterval(() => {
            if (videoEl.readyState >= 1) {
                socket.emit('video:heartbeat', {
                    roomCode,
                    currentTime: videoEl.currentTime,
                    isPlaying: !videoEl.paused,
                    rate: videoEl.playbackRate,
                    timestamp: Date.now() + (window.serverOffset || 0)
                });
            }
        }, 2000);

        return () => clearInterval(heartbeatInterval);
    }, [isHost, videoEl, socket, roomCode]);

    // ── Guest: receive and apply sync events ──────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const applyTimeIfNeeded = (targetTime) => {
            if (!videoEl) return;
            const drift = Math.abs(videoEl.currentTime - targetTime);
            if (drift > DRIFT_THRESHOLD) {
                isSyncingRef.current = true;
                videoEl.currentTime = targetTime;
                setTimeout(() => { isSyncingRef.current = false; }, 500);
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
            if (!videoEl || isHost) return;

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
                videoEl.currentTime = expectedTime;
                setTimeout(() => { isSyncingRef.current = false; }, 500);
            } else if (Math.abs(drift) > 0.25) {
                // Medium drift: Adjust playback rate to scrub gracefully
                videoEl.playbackRate = drift > 0 ? 1.05 : 0.95;
            } else {
                // Synchronized: Restore natural rate
                videoEl.playbackRate = 1.0;
            }
        };

        socket.on('video:play', onPlay);
        socket.on('video:pause', onPause);
        socket.on('video:seek', onSeek);
        socket.on('video:sync-state', onSyncState);
        socket.on('video:sync', onHeartbeatSync);

        return () => {
            socket.off('video:play', onPlay);
            socket.off('video:pause', onPause);
            socket.off('video:seek', onSeek);
            socket.off('video:sync-state', onSyncState);
            socket.off('video:sync', onHeartbeatSync);
        };
    }, [socket, videoEl, isHost, setVideoState, currentVideo]);

    // ── Request sync on mount (for late joiners) ──────────────────────────────
    useEffect(() => {
        if (!socket || !roomCode || isHost) return;
        const timer = setTimeout(() => {
            socket.emit('video:request-sync', { roomCode });
        }, 800);
        return () => clearTimeout(timer);
    }, [socket, roomCode, isHost]);

    return { onBufferStart, onBufferEnd };
};

export default useVideoSync;
