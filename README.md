<div align="center">
  <img src="./frontend/public/favicon.svg" alt="VibeSync Logo" width="120"/>
  <h1>VibeSync</h1>
  <p><strong>Watch Together, In Perfect Sync.</strong></p>
  <p>Zero-latency watch parties with E2EE live chat, WebRTC voice calls, direct live streaming, and synchronized playback across videos, YouTube, and Netflix/Prime (via extension).</p>

  ![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
  ![React](https://img.shields.io/badge/React-18-blue?logo=react)
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
  - **⚡ Live Stream (WebRTC)** — Host streams a local video file *directly to participants* at 40fps via peer-to-peer WebRTC — zero upload wait time.
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
MONGODB_URI=your_mongodb_connection_string
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

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
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
| Frontend | React 18 + Vite, Tailwind CSS, Lucide Icons |
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
