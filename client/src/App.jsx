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
    <div className="app-root">
      <h1>SyncBoard</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', width: '100%', maxWidth: '1000px' }}>
         <p style={{ color: '#9ca3af', margin: 0 }}>Room: {roomId}</p>
         <p style={{ color: '#9ca3af', margin: 0 }}>Playing as: <strong style={{ color: '#e5e7eb' }}>{nickname}</strong></p>
      </div>
      <CanvasBoard socket={socket} roomId={roomId || 'default-room'} nickname={nickname} />
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
    <div className="app-root">
      <h1>SyncBoard</h1>
      <p style={{ marginBottom: '1.5rem', color: '#9ca3af' }}>
        Create a new room or join an existing one to start drawing together.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 420, width: '100%' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <label style={{ fontSize: '0.875rem', color: '#9ca3af', marginLeft: '0.5rem' }}>Your Nickname</label>
            <input 
                type="text" 
                placeholder="e.g. Picasso"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '999px',
                  border: '1px solid #4b5563',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
            />
        </div>

        <div style={{ height: '1px', backgroundColor: '#374151', margin: '0.5rem 0' }} />

        <button
          type="button"
          onClick={handleCreate}
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
