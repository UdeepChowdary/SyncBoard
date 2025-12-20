# SyncBoard

SyncBoard is a real-time collaborative whiteboard application built with React, Konva, and Socket.io.

## Features
- **Real-time Collaboration**: See strokes from other users instantly.
- **Tools**: Pen, Rectangle, Circle, Arrow, and Image Upload.
- **Text Support**: Add and edit text on the canvas.
- **User Presence**: See who is online and their cursor positions.
- **Undo/Redo**: History support for all actions.
- **Export**: Download the board as a PNG image.
- **Dark Mode**: Sleek UI designed for extended coding/drawing sessions.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, React-Konva
- **Backend**: Node.js, Express, Socket.io, MongoDB

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository_url>
    cd SyncBoard
    ```

2.  **Setup Server**
    ```bash
    cd server
    npm install
    cp .env.example .env # (Or create .env with MONGO_URI)
    npm run dev
    ```

3.  **Setup Client**
    ```bash
    cd client
    npm install
    npm run dev
    ```

4.  **Open in Browser**
    Go to `http://localhost:5173`.

## Deployment

### Environment Variables
- **Server**:
    - `MONGO_URI`: Connection string for MongoDB.
    - `CLIENT_URL`: URL of the deployed client (for CORS).
- **Client**:
    - `VITE_SERVER_URL`: URL of the deployed server.

### Recommended Platform: Render.com
- Deploy **Server** as a Web Service.
- Deploy **Client** as a Static Site.
- Connect them using the environment variables above.
