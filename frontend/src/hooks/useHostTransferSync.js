import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import useWebRTC from './useWebRTC';

/**
 * useHostTransferSync
 *
 * Handles WebRTC cleanup when the host role is transferred.
 * Lives in a separate file so host-change logic doesn't
 * clutter the main VideoPlayer or WebRTCContext.
 *
 * Returns a counter that bumps on every host change, so
 * VideoPlayer can reset its local streaming refs in response.
 */
const useHostTransferSync = () => {
    const { socket } = useSocket();
    const { resetStreamState } = useWebRTC();
    const [hostChangedFlag, setHostChangedFlag] = useState(0);

    useEffect(() => {
        if (!socket) return;

        const onHostChanged = () => {
            console.log('[HostTransferSync] Host changed — resetting stream state');
            // Clean up stale video peer connections & UI flags inside WebRTCContext
            resetStreamState();
            // Bump counter so VideoPlayer resets its local streaming refs
            setHostChangedFlag(prev => prev + 1);
        };

        socket.on('room:host-changed', onHostChanged);
        return () => socket.off('room:host-changed', onHostChanged);
    }, [socket, resetStreamState]);

    return { hostChangedFlag };
};

export default useHostTransferSync;
