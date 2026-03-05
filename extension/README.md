# VibeSync Browser Extension

Sync Netflix, Amazon Prime, Disney+ Hotstar, JioCinema, Max, SonyLIV and Zee5  
with your friends in real-time — directly inside their native players.

## How It Works

Each person logs into their own subscription. The extension keeps everyone  
at the **exact same timestamp** — play, pause, seek in sync automatically.  
A mini chat overlay appears on the streaming page so you can react without switching tabs.

> **Each participant needs their own subscription** to the platform.  
> Only playback state (play/pause/timestamp) is synced — no video data is transmitted.

---

## Installation (Chrome / Edge)

1. Download this `extension/` folder
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `extension/` folder
6. The VibeSync icon appears in your toolbar ✅

---

## Usage

1. **Host** creates a room on [vibe-sync-psi.vercel.app](https://vibe-sync-psi.vercel.app) and shares the room code
2. **All participants** install the extension
3. Everyone clicks the VibeSync extension icon, enters their name + the room code, and clicks **Connect**
4. Everyone navigates to the same content on Netflix / Prime / Hotstar etc.
5. Hit **Play** on any device — everyone syncs instantly! 🎉

---

## Supported Platforms

| Platform | Status |
|---|---|
| Netflix | ✅ Supported |
| Amazon Prime Video | ✅ Supported |
| Disney+ Hotstar | ✅ Supported |
| JioCinema | ✅ Supported |
| Disney+ | ✅ Supported |
| Max / HBO Max | ✅ Supported |
| SonyLIV | ✅ Supported |
| Zee5 | ✅ Supported |

---

## Packaging for Distribution

```bash
# From the repo root
cd extension
zip -r ../vibesync-extension.zip . -x "*.DS_Store" -x "__pycache__/*"
```

Then share `vibesync-extension.zip` — recipients unzip and load unpacked.

---

## Advanced: Custom Backend URL

If you self-host the VibeSync backend, click **Advanced settings** in the popup  
and enter your backend URL (e.g. `https://my-vibesync.koyeb.app`).
