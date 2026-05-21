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

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** or **yarn** (Node package manager)
- **MongoDB** (Local installation or MongoDB Atlas cloud database)
- **Git** (For cloning the repository)

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/UdeepChowdary/SyncBoard.git
cd SyncBoard
```

### Step 2: Setup Server

```bash
cd server
npm install
cp .env.example .env
# Edit .env and add your MongoDB connection string
npm run dev
```

**Server Environment Variables:**
```env
MONGO_URI=mongodb://your-connection-string
CLIENT_URL=http://localhost:5173
PORT=5000
```

### Step 3: Setup Client

```bash
cd ../client
npm install
npm run dev
```

**Client Environment Variables:**
```env
VITE_SERVER_URL=http://localhost:5000
```

### Step 4: Access the Application

Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Create a Session** - Start a new collaborative session
2. **Share Link** - Invite others by sharing the session link
3. **Draw & Collaborate** - Use the tools to create and edit in real-time
4. **Export** - Download your work as an image when done

## Deployment

### Deploying to Render.com

#### Server Deployment:
1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Set environment variables:
   - `MONGO_URI` - Your MongoDB connection string
   - `CLIENT_URL` - Your deployed client URL

#### Client Deployment:
1. Create a new Static Site on Render.com
2. Build command: `cd client && npm run build`
3. Publish directory: `client/dist`
4. Set environment variables:
   - `VITE_SERVER_URL` - Your deployed server URL

### Alternative Deployment Options
- **Heroku** - Traditional PaaS hosting
- **Vercel** - Optimal for frontend deployment
- **AWS/Azure/Google Cloud** - Full control and scalability

## Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Roadmap

🚀 **Planned Features:**
- Video/Audio chat integration
- Real-time cursor animations
- Drawing templates and stickers
- Advanced shape tools (polygons, curves)
- Collaborative code editor
- Mobile app (React Native)
- Advanced permissions and roles

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

**Udeep Chowdary**
- GitHub: [@UdeepChowdary](https://github.com/UdeepChowdary)

## Support

For issues, questions, or suggestions:
- Open an issue on [GitHub Issues](https://github.com/UdeepChowdary/SyncBoard/issues)
- Check existing documentation and FAQs

## Acknowledgments

- React and Vite communities for excellent tools
- Konva.js for canvas rendering capabilities
- Socket.io for real-time communication
- MongoDB for reliable database solutions

---

**Happy Collaborating! 🎨✍️**