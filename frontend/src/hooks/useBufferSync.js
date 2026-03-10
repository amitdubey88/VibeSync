import { useEffect, useRef, useState } from 'react';
import { useRoom } from '../context/RoomContext';

/**
 * useBufferSync
 * 
 * Monitors the room participants for people who are buffering.
 * If anyone is buffering, the host automatically pauses playback to wait for them.
 * If they take longer than 8 seconds, the host automatically resumes to prevent locking the room.
 */
const useBufferSync = (videoEl) => {
    const { room, isHost } = useRoom();
    const [bufferingUsers, setBufferingUsers] = useState([]);
    
    const bufferTimeoutRef = useRef(null);
    const wasPlayingBeforeBufferRef = useRef(false);

    useEffect(() => {
        if (!room?.participants || !videoEl) return;

        // Skip buffer synchronization for Live WebRTC streams as they cannot truly be paused safely.
        if (room.currentVideo?.type === 'live' || room.currentVideo?.type === 'uploading') {
            setBufferingUsers([]);
            return;
        }

        // Filter out the host, we only care if guests are struggling to keep up
        const currentlyBuffering = room.participants.filter(p => p.isBuffering && p.id !== room.hostId);
        setBufferingUsers(currentlyBuffering);

        if (!isHost) return;

        if (currentlyBuffering.length > 0) {
            // Someone is buffering. If we are playing, pause to wait for them.
            if (!videoEl.paused) {
                wasPlayingBeforeBufferRef.current = true;
                videoEl.pause();
                // Note: Calling videoEl.pause() inherently triggers the `pause` event listener in `useVideoSync`,
                // which fires the `video:pause` socket event to the rest of the room.
            }

            // Start an 8-second safety fuse so one potato connection doesn't ruin movie night.
            if (!bufferTimeoutRef.current) {
                bufferTimeoutRef.current = setTimeout(() => {
                    if (wasPlayingBeforeBufferRef.current && videoEl.paused) {
                        videoEl.play().catch(() => {});
                    }
                    wasPlayingBeforeBufferRef.current = false;
                }, 8000);
            }
        } else {
            // Everyone is caught up!
            if (bufferTimeoutRef.current) {
                clearTimeout(bufferTimeoutRef.current);
                bufferTimeoutRef.current = null;
            }

            // If we paused specifically *because* of buffering, resume automatically.
            if (wasPlayingBeforeBufferRef.current && videoEl.paused) {
                wasPlayingBeforeBufferRef.current = false;
                videoEl.play().catch(() => {});
            }
        }

    }, [room?.participants, room?.currentVideo?.type, videoEl, isHost]);

    return { bufferingUsers };
};

export default useBufferSync;
