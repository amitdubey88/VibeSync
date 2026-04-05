'use client';

import { useWebRTCContext } from '../context/WebRTCContext';

/**
 * useWebRTC
 * 
 * This hook now acts as a consumer for the WebRTCContext,
 * ensuring that all components share the same WebRTC state 
 * (voice status, remote streams, etc.) and signaling logic.
 */
const useWebRTC = () => {
    return useWebRTCContext();
};

export default useWebRTC;
