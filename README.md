# SyncBoard

A simple and collaborative space to write, draw, or anything you want.

## Project Overview

SyncBoard is a real-time collaborative whiteboard application that enables teams and individuals to work together seamlessly. Whether you're sketching ideas, writing notes, or brainstorming, SyncBoard provides an intuitive platform for real-time collaboration.

## Features

✨ **Core Features:**
- **Real-time Collaboration** - See changes instantly as others draw, write, or edit
- **Drawing Tools** - Pen, Rectangle, Circle, Arrow tools for creative expression
- **Text Support** - Add and edit text directly on the canvas
- **Image Upload** - Insert images to enhance your workspace
- **User Presence** - View who's online and track their cursor positions
- **Undo/Redo** - Full history support for all actions
- **Export Canvas** - Download your board as a PNG image
- **Dark Mode** - Comfortable UI designed for extended work sessions
- **Responsive Design** - Works seamlessly on desktop and tablet devices

## Technology Stack

### Frontend
- **React** - UI library for building interactive components
- **Vite** - Fast build tool and development server
- **TailwindCSS** - Utility-first CSS framework
- **React-Konva** - Canvas rendering and drawing library
- **Socket.io Client** - Real-time communication

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Socket.io** - WebSocket library for real-time events
- **MongoDB** - NoSQL database

### Language Composition
- **JavaScript** - 82.9%
- **TypeScript** - 15.4%
- **Other** - 1.7%

## Architecture & Realtime Synchronization

SyncBoard uses a **hybrid in-memory + optional persistence** architecture designed for ultra-low latency, high resilience, and zero setup friction:

```
                      SyncBoard Client
                    (React + React-Konva)
                             │
                             ▼ Socket.IO WebSockets
                      Node.js Server
                   (Express + Socket.IO)
                             │
                             ▼ Immediate In-Memory Store
                     Active Room State
                     (In-Memory Maps)
                             │
                             ▼ Async Background Save (If Available)
                          MongoDB
                    (Optional Persistence)
```

* **⚡ Real-Time Collaboration Without MongoDB**: The backend server boots immediately and maintains active room states (strokes, shapes, text, sticky notes, host info, and passcodes) in memory. Two or more clients can collaborate in real-time out of the box with **zero database configuration**.
* **💾 Optional Permanent Persistence**: If a `MONGO_URI` is provided (e.g. via a free MongoDB Atlas cluster), the server automatically connects in the background and mirrors room snapshots for long-term persistence across server restarts. If MongoDB goes down or disconnects, the server gracefully continues serving real-time events without interrupting connected users.
* **🔄 Automatic Reconnection & State Recovery**: If a client temporarily drops connection, Socket.IO auto-reconnects, rejoins the room, and synchronizes the latest room snapshot seamlessly.

> [!NOTE]
> **Single-Instance Note**: In-memory room state is held on the active Node.js server instance. For zero-cost single-instance deployments (Render, Hugging Face Spaces, Koyeb, Railway), this provides high-speed collaboration without external dependencies.

---

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** *(Optional)*: Only needed if you want boards to persist across server restarts.

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/UdeepChowdary/SyncBoard.git
cd SyncBoard
```

### 2. Setup & Start Backend Server

```bash
cd server
npm install
npm run dev
```

*The server will start on `http://localhost:5000`.*

**Optional Server `.env` Configuration (`server/.env`):**
```env
PORT=5000
SERVER_PUBLIC_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173
# Optional: Provide MONGO_URI for persistent room storage. Leave blank for in-memory mode.
MONGO_URI=
```

### 3. Setup & Start Frontend Client

```bash
cd ../client
npm install
npm run dev
```

*The client will start on `http://localhost:5173`.*

**Client `.env` Configuration (`client/.env`):**
```env
VITE_SERVER_URL=http://localhost:5000
```

### 4. Open and Collaborate!

Open `http://localhost:5173` in two different browser tabs, create/join the same room (e.g. `room123`), and start collaborating!

---

## 🚀 Free Zero-Cost Deployment Guide

SyncBoard is designed to run 100% free with zero paid infrastructure.

### Option A: Render.com (Blueprint Deployment)
The repository includes a pre-configured [`render.yaml`](render.yaml) blueprint:
1. Fork or push this repository to GitHub.
2. Log into [Render.com](https://render.com) and click **New > Blueprint**.
3. Connect your repository. Render will automatically create:
   - **Backend Web Service** (`syncboard-server`) on Node.js.
   - **Frontend Static Site** (`syncboard-client`).
4. (Optional) Add a free [MongoDB Atlas M0](https://www.mongodb.com/atlas/database) connection string to the `MONGO_URI` environment variable.

### Option B: Hugging Face Spaces (24/7 Free Docker)
Hugging Face Spaces offers **free 24/7 hosting with no sleep**:
1. Create a new Space on [Hugging Face](https://huggingface.co/spaces) with SDK: **Docker**.
2. Push this repository. The root [`Dockerfile`](Dockerfile) automatically builds the server on port `7860`.
3. Deploy the frontend on [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com) for free with `VITE_SERVER_URL=https://<your-hf-space>.hf.space`.

---

## Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy Collaborating! 🎨✍️**