import { useRoom } from '../context/RoomContext';

export const usePolls = () => {
  const { 
    activePoll, 
    createPoll, 
    votePoll, 
    endPoll 
  } = useRoom();

  return { 
    activePoll, 
    createPoll, 
    votePoll, 
    endPoll 
  };
};
