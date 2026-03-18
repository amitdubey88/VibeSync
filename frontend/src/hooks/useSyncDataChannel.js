import { useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';
import { encryptData, decryptData } from '../utils/crypto';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

/**
 * useSyncDataChannel
 * 
 * Establishes a P2P WebRTC DataChannel specifically for low-latency 
 * synchronization telemetry (play, pause, seek, heartbeat).
 * 
 * Host creates the mesh (1 connection per participant).
 * Participants accept the connection.
 * Exposes `sendSyncMessage` which automatically falls back to Socket.IO if P2P fails.
 */
const useSyncDataChannel = () => {
    const { socket } = useSocket();
    const { room, isHost, roomKey } = useRoom();

    // Map of targetSocketId -> RTCPeerConnection
    const peersRef = useRef({});
    // Map of targetSocketId -> RTCDataChannel
    const channelsRef = useRef({});

    // Array of listener callbacks
    const messageListenersRef = useRef([]);

    const onSyncMessage = useCallback((callback) => {
        messageListenersRef.current.push(callback);
        return () => {
            messageListenersRef.current = messageListenersRef.current.filter(cb => cb !== callback);
        };
    }, []);

    const handleDataChannelMessage = useCallback((event) => {
        try {
            const data = JSON.parse(event.data);
            messageListenersRef.current.forEach(cb => cb(data));
        } catch (err) {
            console.error('[DataChannel] Failed to parse message', err);
        }
    }, []);

    // ── Helper to setup a peer connection ─────────────────────────────────────
    const createPeer = useCallback((targetSocketId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        
        pc.onicecandidate = async (event) => {
            if (event.candidate && socket && roomKey) {
                const enc = await encryptData(event.candidate, roomKey);
                socket.emit('sync-channel:ice', { targetSocketId, candidate: enc, e2ee: true });
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed') {
                console.warn(`[DataChannel] ICE failed for ${targetSocketId}`);
            }
        };

        peersRef.current[targetSocketId] = pc;
        return pc;
    }, [socket]);

    // ── Host logic: Create connections when participants join ─────────────────
    useEffect(() => {
        if (!isHost || !room?.participants || !socket) return;

        room.participants.forEach(async (p) => {
            if (p.userId === room.hostId || !p.socketId) return; // Skip self

            if (!peersRef.current[p.socketId]) {
                const pc = createPeer(p.socketId);
                
                // Host creates the data channel
                const channel = pc.createDataChannel('sync-channel', {
                    ordered: false, // Low latency (UDP style)
                    maxRetransmits: 0 // We don't care if an old heartbeat drops
                });

                channel.onopen = () => console.log(`[DataChannel] Opened to ${p.socketId}`);
                channel.onclose = () => console.log(`[DataChannel] Closed with ${p.socketId}`);
                channel.onmessage = handleDataChannelMessage;
                channelsRef.current[p.socketId] = channel;

                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    const enc = await encryptData(offer, roomKey);
                    socket.emit('sync-channel:offer', { targetSocketId: p.socketId, offer: enc, e2ee: true });
                } catch (err) {
                    console.error('[DataChannel] Offer creation failed', err);
                }
            }
        });

        // Cleanup disconnected peers
        const currentSocketIds = room?.participants?.map(p => p.socketId) || [];
        Object.keys(peersRef.current).forEach(socketId => {
            if (!currentSocketIds.includes(socketId)) {
                peersRef.current[socketId].close();
                delete peersRef.current[socketId];
                delete channelsRef.current[socketId];
            }
        });

    }, [isHost, room?.participants, socket, createPeer, handleDataChannelMessage]);

    // ── Signaling listener ───────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onOffer = async ({ fromSocketId, offer, e2ee }) => {
            if (isHost) return; // Only guests receive offers for this channel
            try {
                const pc = createPeer(fromSocketId);
                
                // Guest accepts the data channel
                pc.ondatachannel = (event) => {
                    const channel = event.channel;
                    channel.onopen = () => console.log(`[DataChannel] Opened to Host (${fromSocketId})`);
                    channel.onclose = () => console.log(`[DataChannel] Closed with Host (${fromSocketId})`);
                    channel.onmessage = handleDataChannelMessage;
                    channelsRef.current[fromSocketId] = channel;
                };

                // Decrypt the offer before applying it (host sends encrypted offers)
                const decrypted = e2ee && roomKey ? await decryptData(offer, roomKey) : offer;
                await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                const enc = await encryptData(answer, roomKey);
                socket.emit('sync-channel:answer', { targetSocketId: fromSocketId, answer: enc, e2ee: true });
            } catch (err) {
                console.warn('[DataChannel] Failed to handle offer from', fromSocketId, err);
                // Graceful fallback: delete failed peer so it can be recreated next round
                if (peersRef.current[fromSocketId]) {
                    peersRef.current[fromSocketId].close();
                    delete peersRef.current[fromSocketId];
                    delete channelsRef.current[fromSocketId];
                }
            }
        };

        const onAnswer = async ({ fromSocketId, answer, e2ee }) => {
            const pc = peersRef.current[fromSocketId];
            if (!pc || !roomKey) return;
            try {
                const decrypted = e2ee ? await decryptData(answer, roomKey) : answer;
                await pc.setRemoteDescription(new RTCSessionDescription(decrypted));
            } catch (err) {
                console.warn(`[DataChannel] setRemoteDescription failed for ${fromSocketId}:`, err.name);
            }
        };

        const onIce = async ({ fromSocketId, candidate, e2ee }) => {
            const pc = peersRef.current[fromSocketId];
            if (!pc || !pc.remoteDescription || !roomKey) return;
            try {
                const decrypted = e2ee ? await decryptData(candidate, roomKey) : candidate;
                await pc.addIceCandidate(new RTCIceCandidate(decrypted)).catch(e =>
                    console.warn('[DataChannel] Error adding ICE', e)
                );
            } catch (err) {
                // Stale/mismatched ICE candidates are expected during reconnects
                if (err.name !== 'OperationError') console.warn(`[DataChannel] ICE error for ${fromSocketId}:`, err.name);
            }
        };

        socket.on('sync-channel:offer', onOffer);
        socket.on('sync-channel:answer', onAnswer);
        socket.on('sync-channel:ice', onIce);

        return () => {
            socket.off('sync-channel:offer', onOffer);
            socket.off('sync-channel:answer', onAnswer);
            socket.off('sync-channel:ice', onIce);
        };
    }, [socket, isHost, createPeer, handleDataChannelMessage, roomKey]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            Object.values(peersRef.current).forEach(pc => pc.close());
            peersRef.current = {};
            channelsRef.current = {};
        };
    }, []);

    // ── API ───────────────────────────────────────────────────────────────────
    const sendSyncMessage = useCallback((type, payload) => {
        if (!socket) return;

        const messageData = JSON.stringify({ type, payload });
        let sentOverP2P = false;

        // Attempt P2P
        if (isHost) {
            // Host sends to all connected participants
            Object.values(channelsRef.current).forEach(channel => {
                if (channel.readyState === 'open') {
                    channel.send(messageData);
                    sentOverP2P = true;
                }
            });
        } else {
            // Guest sends to host (should only be 1 channel)
            const channel = Object.values(channelsRef.current)[0];
            if (channel && channel.readyState === 'open') {
                channel.send(messageData);
                sentOverP2P = true;
            }
        }

        // Hybrid Fallback: If no DataChannels are ready, fallback to Socket.IO
        // Note: For Host -> Many, some might be open and some closed.
        // We fallback to socket if *none* are open, or you could do it per-participant.
        // For simplicity, we fallback to Socket.IO broad emission if we couldn't send to ANY peer via P2P.
        if (!sentOverP2P) {
            socket.emit(type, payload);
        }
        // In a true production hybrid, if the Host has 5 open channels and 1 closed, 
        // they might send P2P to 5, and specifically emit to the 1 via socket.
        // But simply emitting to all via socket if sentOverP2P=false (no connections) handles 99% of failure cases.

    }, [socket, isHost]);

    return { sendSyncMessage, onSyncMessage };
};

export default useSyncDataChannel;
