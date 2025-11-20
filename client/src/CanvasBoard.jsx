import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Rect, Circle } from 'react-konva'

function CanvasBoard({ socket, roomId = 'default-room' }) {
  const stageRef = useRef(null)
  const [strokes, setStrokes] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [tool, setTool] = useState('pen') // 'pen' | 'rect' | 'circle' | 'eraser'

  useEffect(() => {
    if (!socket) return

    console.log('[CanvasBoard] joining room', roomId, 'with socket', socket.id)
    socket.emit('join_room', roomId)

    const handleRemoteStroke = (stroke) => {
      setStrokes((prev) => [...prev, stroke])
    }

    const handleRemoteClear = () => {
      setStrokes([])
    }

    socket.on('stroke:created', handleRemoteStroke)
    socket.on('board:clear', handleRemoteClear)

    return () => {
      console.log('[CanvasBoard] cleanup listeners for room', roomId)
      socket.off('stroke:created', handleRemoteStroke)
      socket.off('board:clear', handleRemoteClear)
    }
  }, [socket, roomId])

  const handleMouseDown = (e) => {
    setIsDrawing(true)
    const stage = stageRef.current
    const pointerPosition = stage.getPointerPosition()

    const effectiveColor = tool === 'eraser' ? '#111827' : color
    const effectiveWidth = tool === 'eraser' ? Math.max(strokeWidth * 2, 10) : strokeWidth

    let newShape

    if (tool === 'pen' || tool === 'eraser') {
      newShape = {
        tool: 'pen',
        points: [pointerPosition.x, pointerPosition.y],
        color: effectiveColor,
        strokeWidth: effectiveWidth,
      }
    } else if (tool === 'rect') {
      newShape = {
        tool: 'rect',
        x: pointerPosition.x,
        y: pointerPosition.y,
        width: 0,
        height: 0,
        color,
        strokeWidth,
      }
    } else if (tool === 'circle') {
      newShape = {
        tool: 'circle',
        x: pointerPosition.x,
        y: pointerPosition.y,
        radius: 0,
        color,
        strokeWidth,
      }
    }

    setStrokes((prev) => [...prev, newShape])
  }

  const handleMouseMove = (e) => {
    if (!isDrawing) return

    const stage = stageRef.current
    const point = stage.getPointerPosition()

    setStrokes((prev) => {
      const strokesCopy = [...prev]
      const lastStroke = strokesCopy[strokesCopy.length - 1]
      if (!lastStroke) return strokesCopy

      if (lastStroke.tool === 'pen') {
        lastStroke.points = lastStroke.points.concat([point.x, point.y])
      } else if (lastStroke.tool === 'rect') {
        lastStroke.width = point.x - lastStroke.x
        lastStroke.height = point.y - lastStroke.y
      } else if (lastStroke.tool === 'circle') {
        const dx = point.x - lastStroke.x
        const dy = point.y - lastStroke.y
        lastStroke.radius = Math.sqrt(dx * dx + dy * dy)
      }

      return strokesCopy
    })
  }

  const handleMouseUp = () => {
    setIsDrawing(false)

    if (!socket) return

    setStrokes((prev) => {
      const strokesCopy = [...prev]
      const lastStroke = strokesCopy[strokesCopy.length - 1]
      if (lastStroke) {
        console.log('[CanvasBoard] emitting stroke:created', { roomId, lastStroke })
        socket.emit('stroke:created', { roomId, stroke: lastStroke })
      }
      return strokesCopy
    })
  }

  const handleClear = () => {
    setStrokes([])

    if (socket) {
      socket.emit('board:clear', { roomId })
    }
  }

  const width = window.innerWidth
  const height = window.innerHeight

  return (
    <div className="canvas-container">
      <div className="toolbar" style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setTool('pen')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                border: tool === 'pen' ? '1px solid #d1d5db' : '1px solid #4b5563',
                backgroundColor: tool === 'pen' ? '#111827' : '#020617',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Pen
            </button>

            <button
              type="button"
              onClick={() => setTool('rect')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                border: tool === 'rect' ? '1px solid #d1d5db' : '1px solid #4b5563',
                backgroundColor: tool === 'rect' ? '#111827' : '#020617',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Rect
            </button>

            <button
              type="button"
              onClick={() => setTool('circle')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                border: tool === 'circle' ? '1px solid #d1d5db' : '1px solid #4b5563',
                backgroundColor: tool === 'circle' ? '#111827' : '#020617',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Circle
            </button>

            <button
              type="button"
              onClick={() => setTool('eraser')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                border: tool === 'eraser' ? '1px solid #d1d5db' : '1px solid #4b5563',
                backgroundColor: tool === 'eraser' ? '#111827' : '#020617',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Eraser
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e5e7eb' }}>
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 32, height: 32, padding: 0, border: 'none', background: 'transparent' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e5e7eb' }}>
            Thickness
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
            />
            <span style={{ minWidth: 24, textAlign: 'right' }}>{strokeWidth}</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleClear}
          style={{
            padding: '0.35rem 0.9rem',
            borderRadius: '999px',
            border: '1px solid #4b5563',
            backgroundColor: '#111827',
            color: '#e5e7eb',
            cursor: 'pointer',
          }}
        >
          Clear board
        </button>
      </div>

      <Stage
        ref={stageRef}
        width={width}
        height={height - 120}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        style={{ backgroundColor: '#111827', borderRadius: '0.75rem' }}
      >
        <Layer>
          {strokes.map((shape, idx) => {
            if (shape.tool === 'pen') {
              return (
                <Line
                  key={idx}
                  points={shape.points}
                  stroke={shape.color}
                  strokeWidth={shape.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              )
            }

            if (shape.tool === 'rect') {
              return (
                <Rect
                  key={idx}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  stroke={shape.color}
                  strokeWidth={shape.strokeWidth}
                  listening={false}
                />
              )
            }

            if (shape.tool === 'circle') {
              return (
                <Circle
                  key={idx}
                  x={shape.x}
                  y={shape.y}
                  radius={shape.radius}
                  stroke={shape.color}
                  strokeWidth={shape.strokeWidth}
                  listening={false}
                />
              )
            }

            return null
          })}
        </Layer>
      </Stage>
    </div>
  )
}

export default CanvasBoard
