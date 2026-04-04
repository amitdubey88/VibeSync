/**
 * Feature Handler: Polls, Pin Messages, GIF Messages, Slow Mode, Word Filter, Co-Host, Themes
 *
 * All events here are NEW — zero overlap with existing socket event names.
 * roomStore fields added (all optional, safe defaults):
 *   activePoll, pinnedMessage, slowMode, bannedWords, coHosts, currentTheme
 */

const { hashRoomCode } = require('../utils/hash');

module.exports = (io, socket, roomStore) => {
    // ─── Helper: check if user is host or co-host ─────────────────────────────
    const isPrivileged = (room) => {
        if (!room) return false;
        if (socket.user.id === room.hostId) return true;
        return (room.coHosts || []).includes(socket.user.id);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE 1 — Polls
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('poll:create', ({ roomCode, question, options }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !isPrivileged(room)) return socket.emit('error', { message: 'Only the host or co-host can create polls' });
        
        const hashedCode = hashRoomCode(code);

        // Auto-replace: If there is an existing active poll, officially end it
        if (room.activePoll) {
            room.activePoll.active = false;
            io.to(hashedCode).emit('poll:ended', { poll: room.activePoll });
        }

        if (!question?.trim() || !Array.isArray(options) || options.length < 2) return;

        const messageId = `poll_msg_${Date.now()}`;
        const poll = {
            id: `poll_${Date.now()}`,
            question: question.trim().slice(0, 200),
            options: options.slice(0, 4).map((o, i) => ({ id: i, text: String(o).trim().slice(0, 100), votes: [] })),
            createdBy: socket.user.username,
            createdAt: new Date().toISOString(),
            active: true,
            messageId: messageId // Store for scrolling functionality
        };

        room.activePoll = poll;
        
        // Inject into chat messages so it scrolls naturally
        const pollMessage = {
            id: messageId,
            userId: 'system',
            username: 'Poll',
            content: poll.question,
            options: poll.options,
            pollId: poll.id,
            type: 'poll',
            createdAt: poll.createdAt
        };
        room.messages = room.messages || [];
        room.messages.push(pollMessage);
        if (room.messages.length > 500) room.messages.shift();

        io.to(hashedCode).emit('poll:created', { poll });
        io.to(hashedCode).emit('chat:message', pollMessage);
        
        console.log(`📊 Poll created in ${code}: "${poll.question}" (Replacing existing if any)`);
    });

    socket.on('poll:vote', ({ roomCode, pollId, optionId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !room.activePoll || room.activePoll.id !== pollId) return;

        const poll = room.activePoll;
        if (!poll.active) return;

        // Remove previous vote from this user
        poll.options.forEach(opt => {
            opt.votes = opt.votes.filter(u => u !== socket.user.id);
        });

        // Add vote
        const option = poll.options.find(o => o.id === optionId);
        if (option) {
            option.votes.push(socket.user.id);
        }

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('poll:updated', { poll });
    });

    socket.on('poll:end', ({ roomCode, pollId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !room.activePoll || room.activePoll.id !== pollId || !isPrivileged(room)) return;

        room.activePoll.active = false;
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('poll:ended', { poll: room.activePoll });
        room.activePoll = null;
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE 2 — Pin Messages
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('chat:pin', ({ roomCode, messageId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !isPrivileged(room)) return socket.emit('error', { message: 'Only host or co-host can pin messages' });

        const msg = (room.messages || []).find(m => m.id === messageId);
        if (!msg) return;

        room.pinnedMessage = { 
            id: msg.id, 
            content: msg.content, 
            username: msg.username, 
            pinnedAt: Date.now(),
            e2ee: !!msg.e2ee 
        };
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('chat:pinned', { pinnedMessage: room.pinnedMessage });
    });

    socket.on('chat:unpin', ({ roomCode }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !isPrivileged(room)) return;

        room.pinnedMessage = null;
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('chat:unpinned');
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE 3 — GIF Messages
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('chat:send-gif', ({ roomCode, gifUrl, gifTitle }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return;

        // ── Security: validate gifUrl is a safe HTTP/HTTPS URL ────────────────
        // Block javascript:, data:, and other dangerous URI schemes.
        if (!gifUrl || typeof gifUrl !== 'string') return;
        try {
            const parsed = new URL(gifUrl);
            // Only allow https/http from known GIF CDNs
            const ALLOWED_GIF_HOSTS = [
                'media.giphy.com', 'media0.giphy.com', 'media1.giphy.com',
                'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com',
                'i.giphy.com', 'tenor.com', 'c.tenor.com', 'media.tenor.com',
            ];
            if (!['https:', 'http:'].includes(parsed.protocol)) return;
            if (!ALLOWED_GIF_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) return;
        } catch {
            return; // Invalid URL
        }

        // Slow mode check
        if (room.slowMode?.enabled && socket.user.id !== room.hostId) {
            const cooldown = room.slowMode.cooldown * 1000;
            const lastSent = room.slowMode.lastSentAt?.[socket.user.id] || 0;
            if (Date.now() - lastSent < cooldown) return;
        }

        const message = {
            id: `gif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: socket.user.id,
            username: socket.user.username,
            avatar: socket.user.avatar,
            content: gifUrl,
            title: gifTitle || 'GIF',
            type: 'gif',
            createdAt: new Date().toISOString(),
        };

        room.messages = room.messages || [];
        room.messages.push(message);
        if (room.messages.length > 500) room.messages.shift();

        if (room.slowMode?.enabled) {
            room.slowMode.lastSentAt = room.slowMode.lastSentAt || {};
            room.slowMode.lastSentAt[socket.user.id] = Date.now();
        }

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('chat:message', message);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE 4 — Slow Mode
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('room:slowmode:set', ({ roomCode, enabled, cooldown }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !isPrivileged(room)) return socket.emit('error', { message: 'Only host or co-host can set slow mode' });

        const VALID_COOLDOWNS = [5, 10, 30, 60];
        const safeCooldown = VALID_COOLDOWNS.includes(Number(cooldown)) ? Number(cooldown) : 10;

        room.slowMode = { enabled: !!enabled, cooldown: safeCooldown, lastSentAt: {} };
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:slowmode:updated', { slowMode: { enabled: room.slowMode.enabled, cooldown: room.slowMode.cooldown } });
        console.log(`⏱️ Slow mode in ${code}: ${enabled ? `ON (${safeCooldown}s)` : 'OFF'}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE 5 — Word Filter / Auto-Moderation
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('room:filter:update', ({ roomCode, bannedWords }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !isPrivileged(room)) return socket.emit('error', { message: 'Only host or co-host can update word filter' });

        room.bannedWords = (bannedWords || [])
            .map(w => String(w).toLowerCase().trim())
            .filter(Boolean)
            .slice(0, 100); // max 100 banned words

        socket.emit('room:filter:updated', { bannedWords: room.bannedWords });
        console.log(`🚫 Word filter updated in ${code}: ${room.bannedWords.length} words`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE 12 — Playback Speed Voting
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('speed:vote', ({ roomCode, speed }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room) return;

        const VALID_SPEEDS = [0.75, 1, 1.25, 1.5, 2];
        if (!VALID_SPEEDS.includes(Number(speed))) return;

        room.speedVotes = room.speedVotes || {};
        room.speedVotes[socket.user.id] = Number(speed);

        // Tally votes
        const counts = VALID_SPEEDS.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
        Object.values(room.speedVotes).forEach(s => { counts[s] = (counts[s] || 0) + 1; });
        const totalParticipants = room.participants.filter(p => p.isOnline !== false).length;
        const majority = Math.floor(totalParticipants / 2) + 1;

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('speed:vote-update', { votes: counts, total: totalParticipants });

        // Check majority
        for (const [s, count] of Object.entries(counts)) {
            if (count >= majority) {
                io.to(hashedCode).emit('speed:result', { speed: Number(s), votes: counts });
                room.speedVotes = {}; // Reset votes after result
                break;
            }
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE 15 — Co-Host Role
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('room:assign-cohost', ({ roomCode, targetUserId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || socket.user.id !== room.hostId) return socket.emit('error', { message: 'Only the host can assign co-hosts' });

        const target = room.participants.find(p => p.userId === targetUserId);
        if (!target) return socket.emit('error', { message: 'Participant not found' });

        room.coHosts = room.coHosts || [];
        if (!room.coHosts.includes(targetUserId)) room.coHosts.push(targetUserId);

        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:cohost-updated', { coHosts: room.coHosts });
        io.to(target.socketId).emit('room:cohost-assigned', { assignedBy: socket.user.username });
        console.log(`👑 ${target.username} assigned as co-host in ${code}`);
    });

    socket.on('room:remove-cohost', ({ roomCode, targetUserId }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || socket.user.id !== room.hostId) return socket.emit('error', { message: 'Only the host can remove co-hosts' });

        room.coHosts = (room.coHosts || []).filter(id => id !== targetUserId);
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:cohost-updated', { coHosts: room.coHosts });
        console.log(`✂️ Co-host removed in ${code}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE 19 — Theater Mode Ambient Themes
    // ═══════════════════════════════════════════════════════════════════════════

    socket.on('room:theme:set', ({ roomCode, theme }) => {
        const code = roomCode?.toUpperCase();
        const room = roomStore.get(code);
        if (!room || !isPrivileged(room)) return;

        const VALID_THEMES = ['default', 'crimson', 'ocean', 'forest', 'gold'];
        if (!VALID_THEMES.includes(theme)) return;

        room.currentTheme = theme;
        const hashedCode = hashRoomCode(code);
        io.to(hashedCode).emit('room:theme:changed', { theme });
        console.log(`🎨 Theme changed to ${theme} in ${code}`);
    });
};
