<div align="center">
  <img src="./frontend/public/favicon.svg" alt="VibeSync Logo" width="120"/>
  <h1>VibeSync</h1>
  <p><strong>Watch Together, In Perfect Sync.</strong></p>
  <p>Zero-latency watch parties with E2EE live chat, WebRTC voice calls, direct live streaming, and synchronized playback across videos, YouTube, and Netflix/Prime (via extension).</p>

  ![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
  ![React](https://img.shields.io/badge/React-19-blue?logo=react)
  ![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black?logo=socket.io)
  ![WebRTC](https://img.shields.io/badge/WebRTC-P2P-orange)
  ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)
</div>

<br/>

## ✨ Features

### 🎬 Video Sync
- **Perfect Playback Sync** — Host pause/seek/play is instantly replicated for all participants.
- **Multiple Video Sources**:
  - **Upload** — Upload MP4/WebM/MKV to Cloudinary (or local disk); video is E2EE-encrypted before upload.
  - **Direct URL** — Paste any `.mp4`, `.webm`, `.mkv`, or YouTube link.
  - **⚡ Live Stream (WebRTC)** — Host streams a local video file *directly to participants* via peer-to-peer WebRTC — zero upload wait time.
  - **Binge Platforms** — Sync Netflix, Amazon Prime, Hotstar, JioCinema, Disney+ using the companion Chrome Extension.

### 🔐 End-to-End Encryption (E2EE)
- All **chat messages**, **reactions**, and **uploaded video files** are encrypted with AES-GCM using a PBKDF2 key derived from the room code.
- The encryption key never leaves the client — even server admins cannot read messages or watch uploaded videos.

### 🎙️ WebRTC Voice & Live Audio
- **Voice Chat** — Full-mesh P2P voice channels using WebRTC.
- **Live Stream Audio** — When host live-streams a video, participants hear both the **video's audio** and the **host's microphone** simultaneously.
- **Mute/Unmute** — Host can mute individual participants or all at once.

### 👥 Room Management
- **Public & Private Rooms** — Private rooms are password-protected.
- **Participant Approvals** — Host can require manual approval before guests enter the lobby.
- **Room Lock** — Instantly prevent new joins without a password.
- **Host Transfer** — Host passes crown to someone else before leaving.
- **Participant Limit** — Configurable per room (2–50 participants).
- **Away / BRB Status** — Participants can mark themselves as away.

### 💬 Live Chat
- Real-time encrypted chat with reply threading and floating emoji reactions.
- Chat history persisted in MongoDB (last 100 messages per room).
- Notification sounds + unread badge for missed messages.

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js v18+
- MongoDB Atlas URI (or local MongoDB)
- Cloudinary account *(optional — for large video uploads)*

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
HASH_SECRET=your_hash_secret
FRONTEND_URL=http://localhost:5173

# Optional — Cloudinary (for video uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

```bash
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
```

`frontend/.env` is only required for production builds. For local development, Vite proxies `/api`, `/uploads`, and `/socket.io` to the backend automatically.

For production builds, set:
```env
VITE_API_URL=https://your-backend.example.com
```

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## 🎮 How to Use

### Creating a Room
1. Visit the homepage → enter your name → click **Create Room**.
2. *(Optional)* Set room to **Private** and add a password.
3. Share the **Room Code** or URL with friends.

### Host Controls
| Action | How |
|--------|-----|
| Load a video | Click **Load Video File / URL** in the video area |
| Live stream instantly | Click **Stream Instantly** — shares your file via WebRTC with zero upload |
| Upload & sync | Click **Sync via Upload** — uploads to cloud, participants auto-sync |
| Approve/deny joins | People tab → toggle **Approval ON** |
| Lock the room | People tab → toggle **Room Locked** |
| Mute a participant | People tab → click mute icon next to their name |
| Transfer host | People tab → click transfer icon |
| Delete room | Click 🗑️ **Delete** in the top bar |

### Participating
- **Chat** — Live Chat tab (end-to-end encrypted).
- **Voice** — Click **Join Voice** at the bottom of the sidebar.
- **React** — Click emoji reactions to float them over the video.
- **Away** — Click **BRB** in the top bar to set your status.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite, Tailwind CSS, Lucide Icons |
| Real-time | Socket.IO (events), WebRTC (P2P voice + live stream) |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| File Storage | Cloudinary (streaming proxy) with local disk fallback |
| Encryption | AES-GCM (E2EE chat + video), HMAC-SHA256 (room code hashing) |
| Extension | Chrome Manifest V3, Content Scripts |

---

## 🐳 Docker

```bash
docker-compose up --build
```

Uses the `docker-compose.yml` at the root. Make sure to set the env vars above.

---

## 🤝 Contributing

PRs are welcome! To add support for a new streaming platform in the extension, add its video element selector to `extension/src/content_script.js`.

---

## 🧠 Developer Notes (Code-Accurate)
This repo is split into:
- Web app: `frontend/` (React + Vite)
- Backend: `backend/` (Express + Socket.IO)
- Extension: `extension/` (Chrome/Edge)

### Rooms & Server State
- Live session state is held in an in-memory `roomStore` (`Map<roomCode, roomData>`) in `backend/src/server.js`.
- When MongoDB models are available and connected, rooms/messages can persist and rehydrate after server restart.

### Server-side Room Code Hashing
Room codes are hashed using HMAC-SHA256 with a server-side secret:
- `backend/src/utils/hash.js` uses `HASH_SECRET` (fallback: `vibesync-fallback-secret-2026`)

Invite tokens:
- generated via HMAC-SHA256 of `invite:<roomCode>`, truncated to 12 hex chars
- used to bypass password checks in `POST /api/rooms/:code/join`

### End-to-End Encryption (E2EE) Details
E2EE is fully implemented client-side using Web Crypto (`frontend/src/utils/crypto.js`):
- Key derivation: PBKDF2 (SHA-256, 100000 iterations) with fixed salt `VibeSync-E2EE-Salt-2026`, derived from `roomCode.toUpperCase()`
- Encryption: AES-GCM (256-bit) with random 12-byte IV per payload

When the client marks payloads with `e2ee`, it encrypts:
- chat content + reactions
- video URL/title/type fields used in synced playback
- uploaded video blobs
- WebRTC signaling payloads where the UI enables the `e2ee` flag

The backend only relays/transmits encrypted payloads; it never derives the room E2EE key.

## 🌐 Backend HTTP API Reference
Base URL: `http://localhost:5000`

### Health
- `GET /api/health` (returns `{ status, uptime, rooms, timestamp }`)

### Auth (JWT)
All JWT endpoints require:
- `Authorization: Bearer <jwt>`

- `POST /api/auth/guest` body `{ username }`
- `POST /api/auth/otp/send` body `{ email }`
- `POST /api/auth/otp/verify` body `{ email, otp, username? }`
- `GET /api/auth/me`

### Rooms
- `POST /api/rooms` (host only, Authorization required)
  - body `{ name, type, participantLimit, password?, scheduledAt? }`
- `GET /api/rooms/:code` (no auth; preview)
- `POST /api/rooms/:code/join` (Authorization required)
  - body `{ password?, inviteToken? }`
- `GET /api/rooms/:code/messages` (Authorization required; last 100)
- `GET /api/rooms/video/metadata?url=<url>&type=<youtube|url|file>`

### Upload
- `POST /api/upload` (Authorization required)
  - `multipart/form-data` field name: `video`
  - returns `{ success, url, filename, size }`
- `GET /uploads/*` served for local-storage fallback

### Invite Preview (OpenGraph)
- `GET /invite/:roomCode` (server renders HTML with OpenGraph tags and redirects to the join URL)

### Notifications
- `POST /api/notifications/subscribe` (mock placeholder response, currently)

## 🔌 Extension API (No JWT)
Base: `/api/ext`

- `POST /api/ext/sync/:roomCode` body `{ action, currentTime, isPlaying, pageUrl, platform, username }`
- `GET /api/ext/sync/:roomCode?username=<optional>`
- `POST /api/ext/chat/:roomCode` body `{ message, username }`

## 📺 Supported Platforms (Extension)
These are enabled via the extension’s host permissions / content script match rules:
- Netflix
- Amazon Prime Video
- Hotstar (Disney+ Hotstar)
- JioCinema
- Disney+
- Max / HBO Max
- SonyLIV
- Zee5
- MX Player (mxplayer.in)
- Amazon miniTV (amazon.in/minitv)

## 🎛️ Socket.IO Event Reference (Web App)
Socket auth:
- client sends JWT at connect time: `handshake.auth.token`

### Room control / lifecycle
- `room:join` `{ roomCode }`
- `room:leave` `{ explicit? }`
- `room:get-participants` `{ roomCode }`
- `room:set-status` `{ roomCode, status }`
- Host: `room:set-approval`, `room:approve-join`, `room:deny-join`
- Host: `room:toggle-lock`, `room:transfer-host`, `room:delete`, `room:kick`
- Host: `room:mute`, `room:mute-all`
- Host: `room:toggle-screen-share-permission`

Server emits:
- `room:state`, `room:participant-update`
- join/approval errors and banners (e.g. `room:join-error`, `room:host-away`, etc.)

### Video sync
Host-only (client emits):
- `video:set-uploading`
- `video:set-source`
- `video:play`, `video:pause`, `video:seek`
- `video:heartbeat`
- `video:sync-duration`
- `video:request-sync`
- `video:buffer-start`, `video:buffer-end`
- `video:drift-report`
- `subtitles:set`, `subtitles:clear`
- `video:set-speed`

### Voice (P2P signaling)
Client emits:
- `voice:join`, `voice:offer`, `voice:answer`, `voice:ice-candidate`
- `voice:mute-toggle`, `voice:leave`, `voice:premier-started`

### Chat
Client emits:
- `chat:send`, `chat:reaction`, `chat:typing`
- `chat:message-reaction`
- `chat:delivered`, `chat:read`

### Live streaming signaling
Client emits:
- `video-stream:announce`, `video-stream:request-announce`
- `video-stream:ended`, `video-stream:tracks-replaced`
- `video-stream:offer`, `video-stream:answer`, `video-stream:ice`

### Collaboration / moderation / queue / themes
Client emits:
- polls: `poll:create`, `poll:vote`, `poll:end`
- pin/gifs: `chat:pin`, `chat:unpin`, `chat:send-gif`
- slow mode: `room:slowmode:set`
- word filter: `room:filter:update`
- co-host: `room:assign-cohost`, `room:remove-cohost`
- speed vote: `speed:vote`
- themes: `room:theme:set`
- queue: `queue:suggest`, `queue:approve`, `queue:remove`, `queue:reorder`
