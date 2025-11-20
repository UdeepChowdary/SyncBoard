import { useEffect, useState } from 'react'
import './App.css'
import { io } from 'socket.io-client'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import CanvasBoard from './CanvasBoard'

const socket = io('http://localhost:4000')

function RoomPage() {
  const { roomId } = useParams()

  return (
    <div className="app-root">
      <h1>SyncBoard</h1>
      <p style={{ marginBottom: '0.75rem', color: '#9ca3af' }}>Room: {roomId}</p>
      <CanvasBoard socket={socket} roomId={roomId || 'default-room'} />
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const [joinId, setJoinId] = useState('')

  const createRoom = () => {
    const id = crypto.randomUUID().slice(0, 8)
    navigate(`/room/${id}`)
  }

  const handleJoin = (e) => {
    e.preventDefault()
    const trimmed = joinId.trim()
    if (!trimmed) return
    navigate(`/room/${trimmed}`)
  }

  return (
    <div className="app-root">
      <h1>SyncBoard</h1>
      <p style={{ marginBottom: '1.5rem', color: '#9ca3af' }}>
        Create a new room or join an existing one to start drawing together.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 420, width: '100%' }}>
        <button
          type="button"
          onClick={createRoom}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '999px',
            border: '1px solid #4b5563',
            backgroundColor: '#111827',
            color: '#e5e7eb',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Create new room
        </button>

        <form
          onSubmit={handleJoin}
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%' }}
        >
          <input
            type="text"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Enter room ID to join"
            style={{
              flex: 1,
              padding: '0.6rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid #4b5563',
              backgroundColor: '#020617',
              color: '#e5e7eb',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '999px',
              border: '1px solid #4b5563',
              backgroundColor: '#111827',
              color: '#e5e7eb',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Join
          </button>
        </form>
      </div>
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
