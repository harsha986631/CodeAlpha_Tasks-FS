# 🔒 MeetSync — Real-Time Video Conferencing & Collaboration App

A single-file video conferencing and collaboration tool built with WebRTC, Socket.io, and Express. Supports multi-user video calls, screen sharing, file sharing, a synced whiteboard, and JWT-based authentication.

---

## Features

- **Multi-user video calling** — Mesh WebRTC architecture; every participant connects directly to every other participant.
- **Screen sharing** — Swap your camera feed for your screen live, no reconnect needed.
- **File sharing** — Share files with everyone in the room (demo limit: ~4MB per file).
- **Collaborative whiteboard** — Draw together in real time; new joiners see the full drawing history.
- **Text chat** — Simple in-room chat alongside video.
- **User authentication** — Register/login with hashed passwords (bcrypt) and JWT session tokens.
- **Encrypted media** — WebRTC audio/video streams are encrypted in transit by default (DTLS-SRTP).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Real-time signaling | Socket.io |
| Peer-to-peer media | WebRTC |
| Authentication | bcryptjs (password hashing), jsonwebtoken (JWT) |
| Frontend | Vanilla HTML, CSS, JavaScript (all embedded in `app.js`) |
| Database | In-memory (resets on server restart) |

---

## Prerequisites

- [Node.js](https://nodejs.org/) installed (v16 or newer recommended)
- npm (comes bundled with Node.js)

---

## Installation & Setup

### 1. Clone or download the project files

Make sure `app.js` and this `README.md` are in the same folder.

### 2. Open a terminal in that folder

**Windows (Command Prompt recommended over PowerShell to avoid script-execution issues):**
```cmd
cd "path\to\your\project\folder"
```

**Mac/Linux:**
```bash
cd path/to/your/project/folder
```

### 3. Initialize the project

```bash
npm init -y
```

### 4. Install dependencies

```bash
npm install express socket.io bcryptjs jsonwebtoken
```

### 5. Run the server

```bash
node app.js
```

