'use client';

import { useRoom } from '../context/RoomContext';

export const useWatchQueue = () => {
  const { 
    watchQueue, 
    suggestVideo, 
    approveQueueItem, 
    removeFromQueue, 
    reorderQueue 
  } = useRoom();

  return { 
    queue: watchQueue || [], 
    suggestVideo, 
    approveItem: approveQueueItem, 
    removeItem: removeFromQueue, 
    reorderQueue 
  };
};
