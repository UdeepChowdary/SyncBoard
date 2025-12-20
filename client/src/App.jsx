import { useEffect, useState } from 'react'
import './App.css'
import { io } from 'socket.io-client'
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom'
import CanvasBoard from './CanvasBoard'

const socket = io('http://localhost:4000')

function RoomPage() {
  const { roomId } = useParams()
  const location = useLocation()
  const nickname = location.state?.nickname || 'Guest'

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950">
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          SyncBoard
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <span>Room:</span>
            <span className="font-mono text-gray-200 bg-gray-800 px-2 py-0.5 rounded">{roomId}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span>Playing as:</span>
            <strong className="text-gray-200">{nickname}</strong>
          </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <CanvasBoard socket={socket} roomId={roomId || 'default-room'} nickname={nickname} />
      </div>
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const [joinId, setJoinId] = useState('')
  const [nickname, setNickname] = useState(localStorage.getItem('syncboard_nickname') || '')

  const handleCreate = () => {
    if (!nickname.trim()) {
      alert('Please enter a nickname')
      return
    }
    localStorage.setItem('syncboard_nickname', nickname)
    const id = crypto.randomUUID().slice(0, 8)
    navigate(`/room/${id}`, { state: { nickname } })
  }

  const handleJoin = (e) => {
    e.preventDefault()
    const trimmed = joinId.trim()
    if (!trimmed || !nickname.trim()) {
      if (!nickname.trim()) alert('Please enter a nickname')
      return
    }
    localStorage.setItem('syncboard_nickname', nickname)
    navigate(`/room/${trimmed}`, { state: { nickname } })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent mb-2">
            SyncBoard
          </h1>
          <p className="text-gray-400">
            Collaborative whiteboard for teams
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400 ml-1">Your Nickname</label>
            <input
              type="text"
              placeholder="e.g. Picasso"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 placeholder-gray-600 transition-all"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-500">Start drawing</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            Create new room
          </button>

          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="Enter room ID"
              className="flex-1 px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-100 placeholder-gray-600 transition-all"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 font-medium rounded-xl transition-all active:scale-[0.98]"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-gray-600">
        Share your room ID with others to collaborate in real-time.
      </p>
    </div>
  )
}

function App() {
  useEffect(() => {
    console.log('[App] useEffect mount, socket id:', socket.id)

    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
    })

    return () => {
      console.log('[App] useEffect cleanup')
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
