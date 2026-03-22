import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRoom } from '../context/RoomContext';

/**
 * Parses a simple .srt file string into array of { start, end, text } cues
 */
function parseSRT(srtString) {
  const normalizeRegex = /\r\n|\r|\n/g;
  const blocks = srtString.replace(normalizeRegex, '\n').split('\n\n');
  const cues = [];

  const timeToSec = (timeStr) => {
    const [h, m, s, ms] = timeStr.replace(',', ':').split(':');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  };

  blocks.forEach(block => {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const times = lines[1].split(' --> ');
      if (times.length === 2) {
        cues.push({
          start: timeToSec(times[0]),
          end: timeToSec(times[1]),
          text: lines.slice(2).join('\n')
        });
      }
    }
  });
  return cues;
}

export const useSubtitles = () => {
  const { socket } = useSocket();
  const { room, videoState } = useRoom();
  const [cues, setCues] = useState([]);
  const [activeCue, setActiveCue] = useState(null);

  // Sync active cue with current playback time
  useEffect(() => {
    if (!videoState || cues.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveCue(null);
      return;
    }
    const t = videoState.currentTime;
    const current = cues.find(c => t >= c.start && t <= c.end);
    setActiveCue(current ? current.text : null);
  }, [videoState, videoState?.currentTime, cues]);

  useEffect(() => {
    if (!socket) return;

    const onSubtitlesSet = ({ cues: receivedCues }) => setCues(receivedCues || []);
    const onSubtitlesClear = () => setCues([]);

    socket.on('subtitles:set', onSubtitlesSet);
    socket.on('subtitles:clear', onSubtitlesClear);

    return () => {
      socket.off('subtitles:set', onSubtitlesSet);
      socket.off('subtitles:clear', onSubtitlesClear);
    };
  }, [socket]);

  const loadSubtitles = useCallback((fileContent) => {
    if (!socket || !room) return;
    const parsedCues = parseSRT(fileContent);
    setCues(parsedCues);
    socket.emit('subtitles:set', { roomCode: room.code, cues: parsedCues });
  }, [socket, room]);

  const clearSubtitles = useCallback(() => {
    if (!socket || !room) return;
    setCues([]);
    socket.emit('subtitles:clear', { roomCode: room.code });
  }, [socket, room]);

  return { activeCue, hasSubtitles: cues.length > 0, loadSubtitles, clearSubtitles };
};
