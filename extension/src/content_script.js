/**
 * VibeSync Extension — Content Script
 * Injected into Netflix, Prime, Hotstar, JioCinema, Disney+ etc.
 * - Detects the video element using platform-specific selectors
 * - Syncs play/pause/seek state with VibeSync room via polling
 * - Injects mini overlay (chat + status)
 */

(function () {
  'use strict';

  // ── Platform detection ────────────────────────────────────────────────────
  const PLATFORMS = {
    'netflix.com': {
      name: 'Netflix',
      color: '#e50914',
      videoSelector: 'video',
      titleSelector: '.video-title h4, .PlayerControls--title',
    },
    'primevideo.com': {
      name: 'Amazon Prime',
      color: '#00a8e1',
      videoSelector: 'video',
      titleSelector: '.atvwebplayersdk-title-text',
    },
    'hotstar.com': {
      name: 'Disney+ Hotstar',
      color: '#0f52ba',
      videoSelector: 'video',
      titleSelector: '.title-container .show-title',
    },
    'jiocinema.com': {
      name: 'JioCinema',
      color: '#8c45ff',
      videoSelector: 'video',
      titleSelector: '.title, [class*="title"]',
    },
    'disneyplus.com': {
      name: 'Disney+',
      color: '#113ccf',
      videoSelector: 'video[tabindex]',
      titleSelector: '[class*="title"]',
    },
    'max.com': {
      name: 'Max / HBO',
      color: '#002be0',
      videoSelector: 'video',
      titleSelector: '[class*="title"]',
    },
    'sonyliv.com': {
      name: 'SonyLIV',
      color: '#0061ff',
      videoSelector: 'video',
      titleSelector: '.title',
    },
    'zee5.com': {
      name: 'Zee5',
      color: '#6b21d6',
      videoSelector: 'video',
      titleSelector: '[class*="title"]',
    },
    'mxplayer.in': {
      name: 'MX Player',
      color: '#0132cf',
      videoSelector: 'video',
      titleSelector: '[class*="title"], .video-title',
    },
    'amazon.in': {
      name: 'Amazon MiniTV',
      color: '#ff9900',
      videoSelector: 'video',
      titleSelector: '.minitv-video-title, [class*="title"]',
    },
  };

  const hostname = window.location.hostname.replace('www.', '');
  const platform = Object.keys(PLATFORMS).find((k) => hostname.includes(k));
  if (!platform) return; // not a supported streaming site

  const PLATFORM_INFO = PLATFORMS[platform];

  // ── State ────────────────────────────────────────────────────────────────
  let settings = {};
  let video = null;
  let isSyncing = false;       // prevents echo when we apply remote state
  let lastPushedTime = -1;     // last time we pushed to server
  let lastPushedPlaying = null;
  let pollInterval = null;
  let messages = [];           // local cache of chat messages
  let connected = false;

  // ── Get settings from storage ─────────────────────────────────────────────
  function loadSettings(cb) {
    chrome.storage.local.get(
      ['vs_room_code', 'vs_username', 'vs_backend_url', 'vs_connected', 'vs_show_overlay'],
      (data) => {
        settings = data;
        cb();
      }
    );
  }

  // ── Find video element ────────────────────────────────────────────────────
  function findVideo() {
    return document.querySelector(PLATFORM_INFO.videoSelector);
  }

  function waitForVideo(cb, retries = 30) {
    const v = findVideo();
    if (v && v.readyState >= 1) { cb(v); return; }
    if (retries <= 0) return;
    setTimeout(() => waitForVideo(cb, retries - 1), 1000);
  }

  // ── Push local state to server ────────────────────────────────────────────
  async function pushState(action) {
    if (!settings.vs_room_code || !settings.vs_connected || !video) return;
    const ct = video.currentTime;
    const isPlaying = !video.paused;

    // Avoid duplicate pushes
    if (action === 'timeupdate') {
      if (Math.abs(ct - lastPushedTime) < 2 && isPlaying === lastPushedPlaying) return;
    }
    lastPushedTime = ct;
    lastPushedPlaying = isPlaying;

    const backendUrl = settings.vs_backend_url || 'https://elderly-ameline-vibesync2001-89a44bd5.koyeb.app/';
    try {
      await fetch(`${backendUrl}/api/ext/sync/${settings.vs_room_code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          currentTime: ct,
          isPlaying,
          pageUrl: window.location.href,
          platform: PLATFORM_INFO.name,
          username: settings.vs_username || 'Guest',
        }),
      });
    } catch (_) {}
  }

  // ── Poll server for remote state ──────────────────────────────────────────
  async function pollServer() {
    if (!settings.vs_room_code || !settings.vs_connected) return;
    const backendUrl = settings.vs_backend_url || 'https://elderly-ameline-vibesync2001-89a44bd5.koyeb.app';
    try {
      const res = await fetch(
        `${backendUrl}/api/ext/sync/${settings.vs_room_code}?username=${encodeURIComponent(settings.vs_username || 'Guest')}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.state) return;

      updateOverlayState(data);

      if (!video) return;
      const remote = data.state;
      const myUser = settings.vs_username;

      // Skip if I was the last one to push
      if (remote.pushedBy === myUser) return;

      isSyncing = true;

      // Sync timestamp if drift > 3s
      if (Math.abs(video.currentTime - remote.currentTime) > 3) {
        video.currentTime = remote.currentTime;
      }

      // Sync play/pause
      if (remote.isPlaying && video.paused) {
        video.play().catch(() => {});
      } else if (!remote.isPlaying && !video.paused) {
        video.pause();
      }

      setTimeout(() => { isSyncing = false; }, 500);
    } catch (_) {}
  }

  // ── Attach video event listeners ──────────────────────────────────────────
  function attachListeners(v) {
    video = v;

    v.addEventListener('play',    () => { if (!isSyncing) pushState('play'); });
    v.addEventListener('pause',   () => { if (!isSyncing) pushState('pause'); });
    v.addEventListener('seeked',  () => { if (!isSyncing) pushState('seek'); });
    v.addEventListener('timeupdate', () => { if (!isSyncing) pushState('timeupdate'); });

    // Start polling
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(pollServer, 2000);

    connected = true;
    updateOverlayConnected(true);
    console.log(`[VibeSync] Syncing ${PLATFORM_INFO.name} in room ${settings.vs_room_code}`);
  }

  // ── Chat send ─────────────────────────────────────────────────────────────
  async function sendChat(text) {
    if (!settings.vs_room_code || !text.trim()) return;
    const backendUrl = settings.vs_backend_url || 'https://elderly-ameline-vibesync2001-89a44bd5.koyeb.app/';
    await fetch(`${backendUrl}/api/ext/chat/${settings.vs_room_code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text.trim(),
        username: settings.vs_username || 'Guest',
      }),
    }).catch(() => {});
  }

  // ── Overlay UI ────────────────────────────────────────────────────────────
  function applyOverlayVisibility() {
    const overlay = document.getElementById('vs-overlay');
    if (overlay) {
      overlay.style.display = settings.vs_show_overlay === false ? 'none' : 'block';
    }
  }

  function buildOverlay() {
    if (document.getElementById('vs-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'vs-overlay';
    overlay.innerHTML = `
      <div id="vs-header">
        <span id="vs-logo">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M3 4L10 16L17 4" stroke="#e50914" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          VibeSync
        </span>
        <span id="vs-platform-badge" style="background:${PLATFORM_INFO.color}">${PLATFORM_INFO.name}</span>
        <button id="vs-toggle-btn" title="Minimize">−</button>
      </div>

      <div id="vs-body">
        <div id="vs-status">
          <span id="vs-dot" class="vs-dot-disconnected"></span>
          <span id="vs-status-text">Not connected — open extension popup</span>
        </div>

        <div id="vs-room-info" style="display:none">
          <div id="vs-room-label">Room: <strong id="vs-room-code-display"></strong></div>
          <div id="vs-participants-row"></div>
        </div>

        <div id="vs-chat-area">
          <div id="vs-messages"></div>
          <div id="vs-chat-input-row">
            <input id="vs-chat-input" type="text" placeholder="Chat with room…" maxlength="300" />
            <button id="vs-send-btn">↑</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Toggle minimize
    let minimized = false;
    document.getElementById('vs-toggle-btn').addEventListener('click', () => {
      minimized = !minimized;
      document.getElementById('vs-body').style.display = minimized ? 'none' : 'flex';
      document.getElementById('vs-toggle-btn').textContent = minimized ? '+' : '−';
    });

    // Allow dragging
    makeDraggable(overlay, document.getElementById('vs-header'));

    // Send chat on Enter or button
    const input = document.getElementById('vs-chat-input');
    const sendBtn = document.getElementById('vs-send-btn');
    const doSend = () => {
      sendChat(input.value);
      appendMessage({ username: settings.vs_username || 'You', message: input.value, isOwn: true });
      input.value = '';
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
    sendBtn.addEventListener('click', doSend);

    applyOverlayVisibility();
  }

  function appendMessage({ username, message, isOwn }) {
    const el = document.getElementById('vs-messages');
    if (!el) return;
    const div = document.createElement('div');
    div.className = `vs-msg ${isOwn ? 'vs-msg-own' : ''}`;
    div.innerHTML = `<span class="vs-msg-user">${username}</span><span class="vs-msg-text">${escapeHtml(message)}</span>`;

    // Swipe-to-dismiss logic
    let startX = 0;
    div.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    div.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      if (Math.abs(startX - endX) > 50) { // 50px swipe threshold
        div.style.transition = 'opacity 0.2s';
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 200);
      }
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (div.parentNode) {
        div.style.transition = 'opacity 0.3s';
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 300);
      }
    }, 3000);

    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  function updateOverlayConnected(isConnected) {
    const dot = document.getElementById('vs-dot');
    const txt = document.getElementById('vs-status-text');
    const info = document.getElementById('vs-room-info');
    const codeEl = document.getElementById('vs-room-code-display');
    if (!dot) return;

    if (isConnected) {
      dot.className = 'vs-dot-connected';
      txt.textContent = `Syncing • ${PLATFORM_INFO.name}`;
      info.style.display = 'block';
      if (codeEl) codeEl.textContent = settings.vs_room_code || '';
    } else {
      dot.className = 'vs-dot-disconnected';
      txt.textContent = 'Not connected — open extension popup';
      info.style.display = 'none';
    }
  }

  function updateOverlayState(data) {
    // Update participants
    const row = document.getElementById('vs-participants-row');
    if (row && data.participants) {
      row.innerHTML = data.participants
        .map((p) => `<span class="vs-participant" title="${p}">${p.slice(0, 2).toUpperCase()}</span>`)
        .join('');
    }
    // Show new chat messages
    if (data.messages) {
      const newMsgs = data.messages.filter((m) => !messages.some((c) => c.id === m.id));
      newMsgs.forEach((m) => {
        if (m.username !== settings.vs_username) {
          appendMessage({ username: m.username, message: m.message, isOwn: false });
        }
        messages.push(m);
      });
    }
  }

  function makeDraggable(el, handle) {
    let ox = 0, oy = 0, mx = 0, my = 0;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      ox = el.offsetLeft; oy = el.offsetTop;
      mx = e.clientX; my = e.clientY;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', () => document.removeEventListener('mousemove', onMove), { once: true });
    });
    function onMove(e) {
      el.style.left = `${ox + e.clientX - mx}px`;
      el.style.top = `${oy + e.clientY - my}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Listen for messages from background/popup ─────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'CONNECT') {
      settings = { vs_room_code: msg.roomCode, vs_username: msg.username, vs_backend_url: msg.backendUrl, vs_connected: true };
      // Preserve current overlay setting
      chrome.storage.local.get('vs_show_overlay', (data) => {
        settings.vs_show_overlay = data.vs_show_overlay !== false;
        applyOverlayVisibility();
      });
      updateOverlayConnected(true);
      if (!video) waitForVideo(attachListeners);
      sendResponse({ ok: true });
    }
    else if (msg.type === 'DISCONNECT') {
      settings.vs_connected = false;
      if (pollInterval) clearInterval(pollInterval);
      updateOverlayConnected(false);
      sendResponse({ ok: true });
    }
    else if (msg.type === 'TOGGLE_OVERLAY') {
      settings.vs_show_overlay = msg.show;
      applyOverlayVisibility();
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: true });
    }
    return false; // synchronous
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  loadSettings(() => {
    buildOverlay();
    if (settings.vs_connected && settings.vs_room_code) {
      updateOverlayConnected(true);
      waitForVideo(attachListeners);
    }
  });

})();
