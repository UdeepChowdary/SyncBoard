import { useEffect, useState } from 'react'
import { Sparkles, PenTool, User, Plus, LogIn } from 'lucide-react'

import { io } from 'socket.io-client'
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom'
import CanvasBoard from './CanvasBoard'

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:7860'
const socket = io(SOCKET_URL)

function RoomPage() {
  const { roomId } = useParams()
  const location = useLocation()
  const nickname = location.state?.nickname || 'Guest'

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/50 z-10 shadow-lg">
        <h1 className="text-2xl font-extrabold font-outfit tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm">
          SyncBoard
        </h1>
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-2 text-slate-400">
            <span>Room:</span>
            <span className="font-mono text-cyan-400 bg-slate-950/50 border border-slate-800/80 px-2 py-0.5 rounded shadow-inner">{roomId}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span>Playing as:</span>
            <strong className="text-slate-100 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50 shadow-inner">{nickname}</strong>
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
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-slate-950 p-4 overflow-hidden selection:bg-cyan-500/30">
      {/* Background blur effects */}
      <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-cyan-600/20 rounded-full blur-[128px] pointer-events-none animate-pulse duration-1000"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-fuchsia-600/20 rounded-full blur-[128px] pointer-events-none animate-pulse duration-1000 delay-500"></div>

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-2xl rounded-3xl border border-slate-700/50 p-8 shadow-[0_0_40px_-15px_rgba(0,0,0,0.7)] relative z-10 hover:border-slate-600/50 transition-colors duration-500">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] group hover:scale-105 transition-transform duration-300">
              <PenTool className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <h1 className="text-5xl font-extrabold font-outfit bg-gradient-to-br from-cyan-300 via-blue-500 to-fuchsia-500 bg-clip-text text-transparent mb-3 tracking-tighter drop-shadow-sm">
            SyncBoard
          </h1>
          <p className="text-slate-400 flex items-center justify-center gap-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-fuchsia-400" /> Real-time collaborative workspace
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2 relative group">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1 group-focus-within:text-cyan-400 transition-colors">Your Identity</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Enter a cool nickname..."
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-950/50 border border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-slate-100 placeholder-slate-600 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] font-medium"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="group relative w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)] transition-all active:scale-[0.98] hover:scale-[1.02] overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <Plus className="w-5 h-5 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
            <span className="relative z-10">Create New Space</span>
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800/80"></div>
            </div>
            <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest">
              <span className="px-3 bg-slate-900/40 text-slate-500">Or join existing</span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="Room ID"
              className="flex-1 px-4 py-3 bg-slate-950/50 border border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 text-slate-100 placeholder-slate-600 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] font-mono text-sm"
            />
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 text-slate-200 font-semibold rounded-xl transition-all active:scale-[0.98] hover:scale-[1.02] shadow-sm hover:shadow-[0_0_15px_-3px_rgba(255,255,255,0.1)]"
            >
              <LogIn className="w-4 h-4" /> Join
            </button>
          </form>
        </div>
      </div>

      <p className="mt-10 text-center text-sm font-medium text-slate-500 max-w-xs leading-relaxed tracking-wide">
        Draw, write, and collaborate with your team in real-time, completely sync'd.
      </p>
    </div>
  )
}

function App() {
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
    })

    return () => {
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
