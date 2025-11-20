import { useEffect } from 'react'
import './App.css'
import { io } from 'socket.io-client'
import CanvasBoard from './CanvasBoard'

const socket = io('http://localhost:4000')

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
    <div className="app-root">
      <h1>Interactive Whiteboard</h1>
      <p>Check the browser console to see Socket.io connection logs.</p>
      <CanvasBoard socket={socket} roomId="default-room" />
    </div>
  )
}

export default App
