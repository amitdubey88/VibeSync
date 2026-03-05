// VibeSync Extension — Background Service Worker
// Handles storage and tab messaging coordination

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VibeSync] Extension installed');
});

// Relay messages between popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['vs_room_code', 'vs_username', 'vs_backend_url', 'vs_connected'], (data) => {
      sendResponse(data);
    });
    return true; // keep channel open for async response
  }

  if (msg.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({
      vs_room_code:    msg.roomCode,
      vs_username:     msg.username,
      vs_backend_url:  msg.backendUrl,
      vs_connected:    true,
    }, () => {
      // Notify active tabs to (re)connect
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { type: 'CONNECT', ...msg }).catch(() => {});
        });
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'DISCONNECT') {
    chrome.storage.local.set({ vs_connected: false }, () => sendResponse({ ok: true }));
    return true;
  }
});
