import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Rect, Circle, Arrow, Image as KonvaImage, Group, Text, Transformer } from 'react-konva'
import useImage from 'use-image'

const URLImage = ({ src, ...props }) => {
  const [img] = useImage(src)
  return <KonvaImage image={img} {...props} />
}

function RemoteCursor({ x, y, nickname, color }) {
  return (
    <Group x={x} y={y}>
      <Circle radius={6} fill={color} stroke="#fff" strokeWidth={1} />
      <Text
        text={nickname}
        x={10}
        y={-5}
        fontSize={12}
        fill={color}
        fontStyle="bold"
        shadowColor="rgba(0,0,0,0.5)"
        shadowBlur={2}
      />
    </Group>
  )
}

function CanvasBoard({ socket, roomId = 'default-room', nickname = 'Guest' }) {
  const stageRef = useRef(null)
  const [strokes, setStrokes] = useState([]) // Array of shapes with IDs
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [tool, setTool] = useState('pen') // 'select' | 'pen' | 'rect' | 'circle' | 'eraser' | 'text' | 'arrow' | 'image'
  const [selectedId, setSelectedId] = useState(null) // ID of the selected shape

  // Text Editing State
  const [textEditVisible, setTextEditVisible] = useState(false)
  const [textEditPos, setTextEditPos] = useState({ x: 0, y: 0 })
  const [textEditValue, setTextEditValue] = useState('')
  const [editingId, setEditingId] = useState(null)

  // Remote cursors state: { [socketId]: { x, y, nickname, color } }
  const [remoteUsers, setRemoteUsers] = useState({})
  const [connectedUsers, setConnectedUsers] = useState([])

  useEffect(() => {
    if (!socket) return

    if (!socket) return
    socket.emit('join_room', roomId, nickname)

    const handleRemoteStroke = (stroke) => {
      setStrokes((prev) => [...prev, stroke])
    }

    const handleRemoteUpdate = (updatedShape) => {
      setStrokes((prev) => prev.map(s => s.id === updatedShape.id ? updatedShape : s))
    }

    const handleRemoteDelete = (shapeId) => {
      setStrokes((prev) => prev.filter(s => s.id !== shapeId))
      if (selectedId === shapeId) {
        setSelectedId(null)
      }
    }

    const handleRemoteClear = () => {
      setStrokes([])
      setPast([])
      setFuture([])
      setSelectedId(null)
    }

    const handleRemoteSnapshot = (remoteStrokes) => {
      setStrokes(remoteStrokes || [])
      setPast([])
      setFuture([])
      setSelectedId(null)
    }

    const handleCursorMove = ({ socketId, x, y, nickname: remoteName, color }) => {
      setRemoteUsers((prev) => ({
        ...prev,
        [socketId]: { x, y, nickname: remoteName, color }
      }))
    }

    const handleUserLeft = ({ socketId }) => {
      setRemoteUsers((prev) => {
        const next = { ...prev }
        delete next[socketId]
        return next
      })
    }

    const handleRoomUsers = (users) => {
      setConnectedUsers(users)
    }

    socket.on('stroke:created', handleRemoteStroke)
    socket.on('shape:update', handleRemoteUpdate)
    socket.on('shape:delete', handleRemoteDelete)
    socket.on('board:clear', handleRemoteClear)
    socket.on('board:snapshot', handleRemoteSnapshot)
    socket.on('cursor:move', handleCursorMove)
    socket.on('user:left', handleUserLeft)
    socket.on('room:users', handleRoomUsers)

    return () => {
      socket.off('stroke:created', handleRemoteStroke)
      socket.off('shape:update', handleRemoteUpdate)
      socket.off('shape:delete', handleRemoteDelete)
      socket.off('board:clear', handleRemoteClear)
      socket.off('board:snapshot', handleRemoteSnapshot)
      socket.off('cursor:move', handleCursorMove)
      socket.off('user:left', handleUserLeft)
      socket.off('room:users', handleRoomUsers)
    }
  }, [socket, roomId, nickname])

  // Keydown listener for Deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If editing text, ignore deletion
      if (textEditVisible) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Delete selected shape
        const shapeToDelete = strokes.find(s => s.id === selectedId)
        if (shapeToDelete) {
          setStrokes(prev => prev.filter(s => s.id !== selectedId))
          setSelectedId(null)
          if (socket) {
            socket.emit('shape:delete', { roomId, shapeId: selectedId })
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, strokes, socket, roomId, textEditVisible])


  const handleTextDblClick = (e) => {
    const stage = e.target.getStage()

    // Check if clicked on a text node
    if (e.target.className === 'Text') {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const stageBox = stage.container().getBoundingClientRect()

      // We need position relative to the container
      // Konva absolute position is relative to layer, which matches container if no stage scroll
      // But we need to account for stage DOM position if we fixed position the textarea?
      // Let's assume relative positioning inside the container div.

      setEditingId(node.id())
      setTextEditValue(node.text())
      setTextEditPos({ x: absPos.x, y: absPos.y })
      setTextEditVisible(true)
      setSelectedId(null) // Clear selection to hide transformer handles
    }
  }

  const handleTextEditComplete = () => {
    setTextEditVisible(false)
    if (!editingId) return

    const updatedText = textEditValue

    const shape = strokes.find(s => s.id === editingId)
    if (!shape) return

    // Don't update if nothing changed
    if (shape.text === updatedText) {
      setEditingId(null)
      return
    }

    const updatedShape = { ...shape, text: updatedText }

    setStrokes(prev => prev.map(s => s.id === editingId ? updatedShape : s))
    setEditingId(null)

    if (socket) {
      socket.emit('shape:update', { roomId, shape: updatedShape })
    }
  }

  const handleMouseDown = (e) => {
    // If editing text, strict return to let blur handle it
    if (textEditVisible) return

    // If we are in select mode
    if (tool === 'select') {
      // Check if we clicked on a transformer
      const clickedOnTransformer = e.target.getParent()?.className === 'Transformer';
      if (clickedOnTransformer) {
        return;
      }

      const clickedOnEmpty = e.target === e.target.getStage()
      if (clickedOnEmpty) {
        setSelectedId(null)
        return
      }
      const clickedId = e.target.id()
      if (clickedId) {
        setSelectedId(clickedId)
      } else {
        setSelectedId(null)
      }
      return
    }

    // If Tool is Text
    if (tool === 'text') {
      const stage = stageRef.current
      const point = stage.getPointerPosition()

      const newShape = {
        id: crypto.randomUUID(),
        tool: 'text',
        text: 'Double click to edit',
        x: point.x,
        y: point.y,
        fontSize: 20,
        color: color
      }

      setStrokes(prev => [...prev, newShape])

      if (socket) {
        socket.emit('stroke:created', { roomId, stroke: newShape })
      }

      // Switch back to select for better UX
      setTool('select')
      setSelectedId(newShape.id)
      return
    }

    setIsDrawing(true)
    setSelectedId(null) // Deselect when drawing new things

    // Save current state to history for undo
    setPast((prev) => [...prev, JSON.parse(JSON.stringify(strokes))])
    setFuture([])

    const stage = stageRef.current
    const pointerPosition = stage.getPointerPosition()

    const effectiveColor = tool === 'eraser' ? '#111827' : color
    const effectiveWidth = tool === 'eraser' ? Math.max(strokeWidth * 2, 10) : strokeWidth

    let newShape = {
      id: crypto.randomUUID(), // Generate unique ID
      tool,
      color: effectiveColor,
      strokeWidth: effectiveWidth,
    }

    if (tool === 'pen' || tool === 'eraser') {
      newShape = {
        ...newShape,
        tool: 'pen', // Eraser is just a pen with background color
        points: [pointerPosition.x, pointerPosition.y],
      }
    } else if (tool === 'rect') {
      newShape = {
        ...newShape,
        x: pointerPosition.x,
        y: pointerPosition.y,
        width: 0,
        height: 0,
      }
    } else if (tool === 'circle') {
      newShape = {
        ...newShape,
        x: pointerPosition.x,
        y: pointerPosition.y,
        radius: 0,
      }
    } else if (tool === 'arrow') {
      newShape = {
        ...newShape,
        points: [pointerPosition.x, pointerPosition.y, pointerPosition.x, pointerPosition.y],
      }
    }

    setStrokes((prev) => [...prev, newShape])
  }

  const handleMouseMove = (e) => {
    const stage = stageRef.current
    if (!stage) return
    const point = stage.getPointerPosition()

    // Emit cursor position
    if (socket) {
      socket.emit('cursor:move', { roomId, x: point.x, y: point.y })
    }

    if (!isDrawing) return
    if (tool === 'select') return // Do nothing for drawing if selecting
    if (tool === 'text') return

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
      } else if (lastStroke.tool === 'arrow') {
        const points = lastStroke.points
        // Update the last two points (end of arrow)
        points[2] = point.x
        points[3] = point.y
        lastStroke.points = [...points]
      }

      return strokesCopy
    })
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        const stage = stageRef.current;
        const point = stage ? stage.getPointerPosition() || { x: width / 2, y: height / 2 } : { x: width / 2, y: height / 2 };

        const newShape = {
          id: crypto.randomUUID(),
          tool: 'image',
          x: point.x,
          y: point.y,
          image: dataUrl,
        }

        setStrokes(prev => [...prev, newShape])

        if (socket) {
          socket.emit('stroke:created', { roomId, stroke: newShape })
        }

        // Reset tool to select after upload
        setTool('select')
        setSelectedId(newShape.id)
      };
      reader.readAsDataURL(file);
    }
  }

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (tool === 'image' && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [tool])


  const handleMouseUp = () => {
    if (tool === 'select') return
    if (tool === 'text') return

    setIsDrawing(false)

    if (!socket) return

    setStrokes((prev) => {
      const strokesCopy = [...prev]
      const lastStroke = strokesCopy[strokesCopy.length - 1]
      if (lastStroke) {
        socket.emit('stroke:created', { roomId, stroke: lastStroke })
      }
      return strokesCopy
    })
  }

  // --- Transformation Handlers ---

  const handleDragEnd = (e) => {
    const id = e.target.id()
    if (!id) return

    // Find the shape and update its coords
    const shape = strokes.find(s => s.id === id)
    if (!shape) return

    const newAttrs = {
      x: e.target.x(),
      y: e.target.y()
    }

    const updatedShape = { ...shape, ...newAttrs }
    setStrokes(prev => prev.map(s => s.id === id ? updatedShape : s))

    if (socket) {
      socket.emit('shape:update', { roomId, shape: updatedShape })
    }
  }

  const handleTransformEnd = (e) => {
    const node = e.target
    const id = node.id()
    if (!id) return

    const shape = strokes.find(s => s.id === id)
    if (!shape) return

    const scaleX = node.scaleX()
    const scaleY = node.scaleY()

    node.scaleX(1)
    node.scaleY(1)

    let updatedShape = { ...shape, x: node.x(), y: node.y(), rotation: node.rotation() }

    if (shape.tool === 'rect') {
      updatedShape.width = node.width() * scaleX
      updatedShape.height = node.height() * scaleY
    } else if (shape.tool === 'circle') {
      updatedShape.radius = node.radius() * Math.max(Math.abs(scaleX), Math.abs(scaleY))
    } else if (shape.tool === 'text') {
      // For text, we usually just update scale, but we can also update fontSize
      // But simpler to just update scaleX/scaleY
      node.scaleX(scaleX)
      node.scaleY(scaleY)
      updatedShape = {
        ...shape,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: scaleX,
        scaleY: scaleY
      }
    } else {
      node.scaleX(scaleX)
      node.scaleY(scaleY)
      updatedShape = {
        ...shape,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: scaleX,
        scaleY: scaleY
      }
    }

    setStrokes(prev => prev.map(s => s.id === id ? updatedShape : s))

    if (socket) {
      socket.emit('shape:update', { roomId, shape: updatedShape })
    }
  }



  const handleClear = () => {
    // Save current state before clearing
    setPast((prev) => [...prev, JSON.parse(JSON.stringify(strokes))])
    setFuture([])
    setStrokes([])
    setSelectedId(null)

    if (socket) {
      socket.emit('board:clear', { roomId })
    }
  }

  const width = window.innerWidth
  const height = window.innerHeight

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  const handleUndo = () => {
    if (!canUndo) return

    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast
      const newPast = prevPast.slice(0, prevPast.length - 1)
      const previous = prevPast[prevPast.length - 1]

      setFuture((prevFuture) => [...prevFuture, JSON.parse(JSON.stringify(strokes))])
      const snapshot = previous || []
      setStrokes(snapshot)
      setSelectedId(null)

      if (socket) {
        socket.emit('board:snapshot', { roomId, strokes: snapshot })
      }

      return newPast
    })
  }

  const handleRedo = () => {
    if (!canRedo) return

    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture
      const newFuture = prevFuture.slice(0, prevFuture.length - 1)
      const next = prevFuture[prevFuture.length - 1]

      setPast((prevPast) => [...prevPast, JSON.parse(JSON.stringify(strokes))])
      const snapshot = next || []
      setStrokes(snapshot)
      setSelectedId(null)

      if (socket) {
        socket.emit('board:snapshot', { roomId, strokes: snapshot })
      }

      return newFuture
    })
  }

  const handleExport = () => {
    if (!stageRef.current) return

    const uri = stageRef.current.toDataURL({ pixelRatio: 2 })

    const link = document.createElement('a')
    link.href = uri
    link.download = `syncboard-${roomId || 'board'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="relative flex flex-col h-full bg-gray-900">

      {/* Connected Users List - Floating Top Right */}
      <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-xl border border-gray-700 z-50 min-w-[200px] shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-gray-200 border-b border-gray-700 pb-2">
          Users ({connectedUsers.length})
        </h3>
        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
          {connectedUsers.map(user => (
            <div key={user.socketId} className="flex items-center gap-2 text-sm text-gray-300">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: user.color }}></div>
              <span className="truncate">{user.nickname} {user.socketId === socket?.id ? '(You)' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-3 p-2 bg-gray-800 rounded-xl border border-gray-700 shadow-lg mx-4 z-40">
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-gray-900 p-1.5 rounded-lg border border-gray-700">
            {/* Hidden file input for current image tool */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
            {['select', 'text', 'pen', 'rect', 'circle', 'arrow', 'image', 'eraser'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTool(t); setSelectedId(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tool === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-700"></div>

          <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
            Color
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-600 ring-2 ring-gray-800 transition-transform hover:scale-105">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer"
              />
            </div>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
            Width
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="w-6 text-right text-gray-200 font-mono">{strokeWidth}</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-1.5 rounded-lg border border-red-900/50 bg-red-900/20 text-red-400 text-xs font-medium hover:bg-red-900/40 transition-colors"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors"
          >
            Export
          </button>

          <div className="flex gap-2 pl-3 border-l border-gray-700">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${canUndo
                ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'border-gray-800 bg-gray-900 text-gray-600 cursor-not-allowed'
                }`}
            >
              Undo
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${canRedo
                ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'border-gray-800 bg-gray-900 text-gray-600 cursor-not-allowed'
                }`}
            >
              Redo
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 bg-gray-950 overflow-hidden m-4 mt-0 rounded-2xl border border-gray-800 shadow-2xl">
        {/* Text Area Overlay for Editing */}
        {textEditVisible && (
          <textarea
            value={textEditValue}
            onChange={(e) => setTextEditValue(e.target.value)}
            onBlur={handleTextEditComplete}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextEditComplete();
              }
            }}
            style={{
              position: 'absolute',
              top: textEditPos.y,
              left: textEditPos.x,
              width: Math.max(100, textEditValue.length * 10) + 'px',
              height: 'auto'
            }}
            className="text-xl p-0 m-0 overflow-hidden bg-transparent outline-none resize-none z-50 font-sans leading-none border border-blue-500 rounded text-blue-400"
            autoFocus
          />
        )}

        <Stage
          ref={stageRef}
          width={width}
          height={height - 140}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onDblClick={handleTextDblClick}
          className="cursor-crosshair"
        >
          <Layer>
            {strokes.map((shape) => {
              const isSelected = shape.id === selectedId
              const commonProps = {
                key: shape.id,
                id: shape.id,
                draggable: tool === 'select',
                onDragEnd: handleDragEnd,
                onTransformEnd: handleTransformEnd,
                opacity: 1,
                // Apply transforms if they exist
                x: shape.x || 0,
                y: shape.y || 0,
                rotation: shape.rotation || 0,
                scaleX: shape.scaleX || 1,
                scaleY: shape.scaleY || 1,
              }

              if (shape.tool === 'pen') {
                return (
                  <Line
                    {...commonProps}
                    points={shape.points}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    hitStrokeWidth={25}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                )
              }

              if (shape.tool === 'rect') {
                return (
                  <Rect
                    {...commonProps}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                  />
                )
              }

              if (shape.tool === 'circle') {
                return (
                  <Circle
                    {...commonProps}
                    radius={shape.radius}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                  />
                )
              }

              if (shape.tool === 'text') {
                // Hide text if it is being edited to avoid duplication
                if (shape.id === editingId) return null;

                return (
                  <Text
                    {...commonProps}
                    text={shape.text}
                    fontSize={shape.fontSize || 20}
                    fill={shape.color}
                    fontFamily="sans-serif"
                  />
                )
              }

              if (shape.tool === 'arrow') {
                return (
                  <Arrow
                    {...commonProps}
                    points={shape.points}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    fill={shape.color}
                  />
                )
              }

              if (shape.tool === 'image') {
                return (
                  <URLImage
                    {...commonProps}
                    src={shape.image}
                  />
                )
              }

              return null
            })}

            {/* Transformer */}
            <TransformerComponent selectedShape={strokes.find(s => s.id === selectedId)} />

          </Layer>

          {/* Remote Cursors Layer */}
          <Layer>
            {Object.keys(remoteUsers).map(socketId => {
              const user = remoteUsers[socketId]
              return (
                <RemoteCursor
                  key={socketId}
                  x={user.x}
                  y={user.y}
                  nickname={user.nickname}
                  color={user.color}
                />
              )
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}

// Helper to attach transformer to selected node
const TransformerComponent = ({ selectedShape }) => {
  const trRef = useRef(null)

  useEffect(() => {
    if (selectedShape && trRef.current) {
      // Find the selected node
      const stage = trRef.current.getStage()
      const selectedNode = stage.findOne('#' + selectedShape.id)
      if (selectedNode) {
        trRef.current.nodes([selectedNode])
        trRef.current.getLayer().batchDraw()
      } else {
        trRef.current.nodes([])
      }
    } else if (trRef.current) {
      trRef.current.nodes([])
    }
  }, [selectedShape])

  return <Transformer ref={trRef} />
}

export default CanvasBoard
