<div align="center">
  <img src="frontend/public/logo.png" alt="VibeSync Logo" width="120"/>
  <h1>VibeSync</h1>
  <p><strong>Watch Together, In Perfect Sync.</strong></p>
  <p>Zero-latency watch parties with live chat, voice calls, and synchronized playback across videos, YouTube, and Netflix/Prime (via extension).</p>
</div>

<br/>

## ✨ Features

- **Perfect Playback Sync**: If the host pauses, seeks, or plays, everyone in the room syncs instantly.
- **Multiple Video Sources**:
  - **Direct Uploads**: Upload an MP4/WebM to Cloudinary (or local disk/memory)
  - **Direct URLs**: Paste any `.mp4`, `.webm`, or YouTube URL
  - **Binge Platforms (Native)**: Sync Netflix, Amazon Prime, Hotstar, JioCinema, and Disney+ using the companion **Chrome Extension**.
- **Real-time Communication**: Wait-free WebRTC voice chat and live text chat.
- **Role-based Access**: Host controls video playback; guests can watch, chat, and join voice. The host can transfer host status before leaving.
- **Participant Approvals**: The host can toggle room security to require manual approval for new guests.

---

## 📽️ Browser Extension (Netflix, Prime, Hotstar Sync)

Since streaming platforms use DRM encryption, they cannot be embedded. The VibeSync Extension solves this by syncing your native tabs!

### How to use the extension:
1. Every participant needs their **own subscription/account** for the platform (Netflix, Prime, etc).
2. Download the `extension` folder from this repo.
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer mode** (top right).
5. Click **Load unpacked** and select the `extension` folder.
6. Click the extension icon, enter your **Room Code**, and hit Connect.
7. Start watching on Netflix — playback will sync for everyone in the room!

> 💡 *The extension injects a beautiful draggable live chat overlay right onto your Netflix/Prime page!*

---

## 🚀 Quick Start Guide (Local Setup)

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas cluster (or local MongoDB)
- Cloudinary account (for handling 100MB+ video file uploads; optional, but recommended)

### 1. Backend Setup
\`\`\`bash
cd backend
npm install
\`\`\`
Create a `.env` file in `backend/`:
\`\`\`env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173

# Optional: For Cloudinary video uploads
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
\`\`\`
Start the backend:
\`\`\`bash
npm run dev
\`\`\`

### 2. Frontend Setup
\`\`\`bash
cd frontend
npm install
\`\`\`
Create a `.env` file in `frontend/`:
\`\`\`env
VITE_API_URL=http://localhost:5000
\`\`\`
Start the frontend:
\`\`\`bash
npm run dev
\`\`\`

---

## 🎮 How to Use VibeSync

### Creating a Room
1. Visit the app homepage.
2. Enter your name and click **Create Room**.
3. (Optional) Toggle to "Private Room" and add a password.
4. Once inside, copy the **Room Code** (or the URL) and share it with friends!

### Managing the Room (Host)
- **Load Video**: Click "Load Video File / URL" to upload a local MP4, paste a direct URL, or paste a YouTube link.
- **Start Extension Sync**: Tell everyone to open Netflix, click the VibeSync extension, and connect to the room code.
- **Participant Control**: From the **People** tab, you can see everyone online. If *Approval ON* is active, newly joined guests will wait in the lobby until you click ✅ Approve.
- **Leave/Transfer**: If you click Leave Room, you'll be prompted to transfer Host powers to someone else.

### Participating
- **Chat**: Use the Live Chat tab to talk with everyone.
- **Voice**: Click the **Join Voice** button at the bottom right to connect your microphone (uses WebRTC via PeerJS).
- **Controls**: Guests cannot pause or seek the video. If your video drifts or buffers, wait a few seconds — VibeSync will automatically force-sync your player to the host's exact position.

---

## 🛠️ Technology Stack

- **Frontend**: React + Vite, Tailwind CSS, Lucide Icons, PeerJS (WebRTC Voice)
- **Backend**: Node.js + Express, Socket.IO (Real-time events), MongoDB + Mongoose
- **File Storage**: Cloudinary (Memory streaming) with Local Disk fallback
- **Browser Extension**: Manifest V3, injected Content Scripts, polling-based background sync

## 🤝 Contributing
Pull requests are welcome! If you'd like to add support for a new streaming platform in the extension, you can add its video selector string to `extension/src/content_script.js`.
