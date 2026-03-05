// VibeSync Extension — Popup Script

const DEFAULT_BACKEND = 'https://vibesync.koyeb.app';

// DOM refs
const dot = document.getElementById('dot');
const statusText = document.getElementById('status-text');
const statusPlatform = document.getElementById('status-platform');
const inputUsername = document.getElementById('input-username');
const inputRoomCode = document.getElementById('input-room-code');
const inputBackendUrl = document.getElementById('input-backend-url');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const connectForm = document.getElementById('connect-form');
const connectedActions = document.getElementById('connected-actions');
const participantsSection = document.getElementById('participants-section');
const participantsList = document.getElementById('participants-list');
const advancedToggle = document.getElementById('advanced-toggle');
const advancedSection = document.getElementById('advanced-section');

// ── Helpers ──────────────────────────────────────────────────────────────────
function setConnected(is, roomCode, platform, participants) {
  if (is) {
    dot.className = 'dot on';
    statusText.textContent = `Syncing in room ${roomCode}`;
    if (platform) {
      statusPlatform.style.display = '';
      statusPlatform.textContent = platform;
    }
    connectForm.style.display = 'none';
    connectedActions.style.display = 'flex';
    if (participants?.length) {
      participantsSection.style.display = 'block';
      participantsList.innerHTML = participants.map((p) => `
        <div class="participant-chip">
          <div class="participant-avatar">${p.slice(0,2).toUpperCase()}</div>
          <span>${p}</span>
        </div>
      `).join('');
    }
  } else {
    dot.className = 'dot off';
    statusText.textContent = 'Not connected';
    statusPlatform.style.display = 'none';
    connectForm.style.display = 'block';
    connectedActions.style.display = 'none';
    participantsSection.style.display = 'none';
  }
}

// ── Load saved state ──────────────────────────────────────────────────────────
chrome.storage.local.get(
  ['vs_room_code', 'vs_username', 'vs_backend_url', 'vs_connected'],
  async (data) => {
    if (data.vs_username) inputUsername.value = data.vs_username;
    if (data.vs_room_code) inputRoomCode.value = data.vs_room_code;
    if (data.vs_backend_url) inputBackendUrl.value = data.vs_backend_url;

    if (data.vs_connected && data.vs_room_code) {
      setConnected(true, data.vs_room_code);
      // Try to get current participants
      const backendUrl = data.vs_backend_url || DEFAULT_BACKEND;
      try {
        const res = await fetch(`${backendUrl}/api/ext/sync/${data.vs_room_code}`);
        if (res.ok) {
          const d = await res.json();
          setConnected(true, data.vs_room_code, d.state?.platform, d.participants);
        }
      } catch (_) {}
    }
  }
);

// ── Connect ───────────────────────────────────────────────────────────────────
btnConnect.addEventListener('click', async () => {
  const username = inputUsername.value.trim();
  const roomCode = inputRoomCode.value.trim().toUpperCase();
  const backendUrl = (inputBackendUrl.value.trim() || DEFAULT_BACKEND).replace(/\/$/, '');

  if (!username) { inputUsername.focus(); alert('Please enter your name.'); return; }
  if (!roomCode || roomCode.length < 4) { inputRoomCode.focus(); alert('Please enter a valid room code.'); return; }

  btnConnect.disabled = true;
  btnConnect.textContent = 'Connecting…';

  // Verify room exists
  try {
    const res = await fetch(`${backendUrl}/api/rooms/${roomCode}`);
    if (!res.ok) throw new Error('Room not found');
  } catch (e) {
    alert(`Could not connect: ${e.message}\n\nMake sure the room code is correct and the backend URL is reachable.`);
    btnConnect.disabled = false;
    btnConnect.textContent = '▶ Connect to Room';
    return;
  }

  // Save settings
  chrome.runtime.sendMessage(
    { type: 'SAVE_SETTINGS', roomCode, username, backendUrl },
    () => {
      setConnected(true, roomCode);
      btnConnect.disabled = false;
      btnConnect.textContent = '▶ Connect to Room';
    }
  );
});

// ── Disconnect ────────────────────────────────────────────────────────────────
btnDisconnect.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'DISCONNECT' }, () => {
    setConnected(false);
  });
});

// ── Advanced toggle ───────────────────────────────────────────────────────────
advancedToggle.addEventListener('click', () => {
  const open = advancedSection.classList.toggle('open');
  advancedToggle.textContent = `Advanced settings ${open ? '▴' : '▾'}`;
});

// ── Room code: auto-uppercase ─────────────────────────────────────────────────
inputRoomCode.addEventListener('input', () => {
  inputRoomCode.value = inputRoomCode.value.toUpperCase();
});
