import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Stage, Layer, Line, Rect, Circle, Arrow, Image as KonvaImage, Group, Text, Transformer } from 'react-konva'
import useImage from 'use-image'
import { jsPDF } from 'jspdf'
import Toolbar from './components/Toolbar'
import UsersSidebar from './components/UsersSidebar'

const URLImage = ({ src, ...props }) => {
  const [img] = useImage(src, 'anonymous')
  return <KonvaImage image={img} {...props} />
}

const getRelativePointerPosition = (stage) => {
  const pos = stage.getPointerPosition()
  if (!pos) return { x: 0, y: 0 }
  return {
    x: (pos.x - stage.x()) / stage.scaleX(),
    y: (pos.y - stage.y()) / stage.scaleY()
  }
}

const RemoteCursor = React.memo(function RemoteCursor({ x, y, nickname, color }) {
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
})

function CanvasBoard({ socket, roomId = 'default-room', nickname = 'Guest' }) {
  const stageRef = useRef(null)
  const lastCursorEmitRef = useRef(0)
  // Refs for spacebar panning
  const spacebarPressedRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const stagePosAtPanStartRef = useRef({ x: 0, y: 0 })
  // Refs for pinch-to-zoom
  const lastDistRef = useRef(null)
  const [strokes, setStrokes] = useState([]) // Array of shapes with IDs
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [tool, setTool] = useState('pen') // 'select' | 'pen' | 'rect' | 'circle' | 'eraser' | 'text' | 'arrow' | 'image' | 'laser' | 'hand'
  const [selectedId, setSelectedId] = useState(null) // ID of the selected shape
  const [isFilled, setIsFilled] = useState(false)
  const [localLaser, setLocalLaser] = useState([])

  // Text Editing State
  const [textEditVisible, setTextEditVisible] = useState(false)
  const [textEditPos, setTextEditPos] = useState({ x: 0, y: 0 })
  const [textEditValue, setTextEditValue] = useState('')
  const [editingId, setEditingId] = useState(null)

  // Stage Pan & Zoom
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(1)

  const [remoteUsers, setRemoteUsers] = useState({})
  const [connectedUsers, setConnectedUsers] = useState([])
  const [remoteLasers, setRemoteLasers] = useState({})
  const [remoteSelections, setRemoteSelections] = useState({})
  const [isHost, setIsHost] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(socket?.connected ? 'connected' : 'reconnecting')

  // Emit selection changes
  useEffect(() => {
    if (socket) {
      socket.emit('selection:update', { roomId, shapeId: selectedId });
    }
  }, [selectedId, socket, roomId]);

  useEffect(() => {
    if (!socket) return

    const joinCurrentRoom = (pin) => {
      console.log(`[Socket] Joining room "${roomId}" as "${nickname}" (socketId: ${socket.id})`);
      socket.emit('join_room', roomId, nickname, pin);
    };

    if (socket.connected) {
      setConnectionStatus('connected');
      joinCurrentRoom();
    } else {
      setConnectionStatus('reconnecting');
    }

    const handleConnect = () => {
      console.log(`[Socket] Connected / Reconnected with id: ${socket.id}`);
      setConnectionStatus('connected');
      joinCurrentRoom();
    };

    const handleDisconnect = (reason) => {
      console.warn(`[Socket] Disconnected: ${reason}`);
      setConnectionStatus('disconnected');
    };

    const handleConnectError = (err) => {
      console.warn(`[Socket] Connection error:`, err.message);
      setConnectionStatus('reconnecting');
    };

    const handleJoinError = ({ message }) => {
      if (message === 'Invalid passcode' || message === 'Passcode required') {
        const pin = prompt('Enter 4-digit PIN for this locked room:');
        if (pin) {
          joinCurrentRoom(pin);
        } else {
          window.location.href = '/';
        }
      } else {
        alert(message);
        window.location.href = '/';
      }
    };

    const handleRoomLocked = () => {
      alert('This room has been locked by a user.');
    };

    const handleRemoteStroke = (stroke) => {
      setStrokes((prev) => [...prev, stroke]);
    };

    const handleRemoteUpdate = (updatedShape) => {
      setStrokes((prev) => prev.map(s => s.id === updatedShape.id ? updatedShape : s));
    };

    const handleRemoteDelete = (shapeId) => {
      setStrokes((prev) => prev.filter(s => s.id !== shapeId));
      if (selectedId === shapeId) {
        setSelectedId(null);
      }
    };

    const handleRemoteClear = () => {
      setStrokes([]);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedId(null);
    };

    const handleRemoteSnapshot = (remoteStrokes) => {
      console.log(`[Room] Received board snapshot with ${remoteStrokes?.length || 0} strokes`);
      setStrokes(remoteStrokes || []);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedId(null);
    };

    const handleCursorMove = ({ socketId, x, y, nickname: remoteName, color }) => {
      setRemoteUsers((prev) => ({
        ...prev,
        [socketId]: { x, y, nickname: remoteName, color }
      }));
    };

    const handleUserLeft = ({ socketId }) => {
      setRemoteUsers((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      setRemoteLasers((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      setRemoteSelections((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    const handleRoomUsers = (users) => {
      setConnectedUsers(users);
      // Determine if current socket is the host
      const me = users.find(u => u.socketId === socket.id);
      if (me) setIsHost(!!me.isHost);
    };

    const handleLaserUpdate = ({ socketId, points, color }) => {
      setRemoteLasers((prev) => ({
        ...prev,
        [socketId]: { points, color }
      }));
    };

    const handleLaserClear = ({ socketId }) => {
      setRemoteLasers((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    const handleSelectionUpdate = ({ socketId, shapeId, color }) => {
      setRemoteSelections(prev => {
        const next = { ...prev };
        if (shapeId) {
          next[socketId] = { shapeId, color };
        } else {
          delete next[socketId];
        }
        return next;
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('room:join_error', handleJoinError);
    socket.on('room:locked', handleRoomLocked);
    socket.on('stroke:created', handleRemoteStroke);
    socket.on('shape:update', handleRemoteUpdate);
    socket.on('shape:delete', handleRemoteDelete);
    socket.on('board:clear', handleRemoteClear);
    socket.on('board:snapshot', handleRemoteSnapshot);
    socket.on('cursor:move', handleCursorMove);
    socket.on('user:left', handleUserLeft);
    socket.on('room:users', handleRoomUsers);
    socket.on('laser:update', handleLaserUpdate);
    socket.on('laser:clear', handleLaserClear);
    socket.on('selection:update', handleSelectionUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('room:join_error', handleJoinError);
      socket.off('room:locked', handleRoomLocked);
      socket.off('stroke:created', handleRemoteStroke);
      socket.off('shape:update', handleRemoteUpdate);
      socket.off('shape:delete', handleRemoteDelete);
      socket.off('board:clear', handleRemoteClear);
      socket.off('board:snapshot', handleRemoteSnapshot);
      socket.off('cursor:move', handleCursorMove);
      socket.off('user:left', handleUserLeft);
      socket.off('room:users', handleRoomUsers);
      socket.off('laser:update', handleLaserUpdate);
      socket.off('laser:clear', handleLaserClear);
      socket.off('selection:update', handleSelectionUpdate);
    };
  }, [socket, roomId, nickname]);

  // Spacebar panning
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !textEditVisible) {
        e.preventDefault();
        spacebarPressedRef.current = true;
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spacebarPressedRef.current = false;
        isPanningRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [textEditVisible]);

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
          setUndoStack(prev => [...prev, { type: 'delete', id: selectedId, shape: shapeToDelete }])
          setRedoStack([])
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
    if (!stage) return

    const target = e.target
    let shapeId = target.id()
    if (!shapeId && target.getParent()?.className === 'Group') {
      shapeId = target.getParent()?.id()
    }

    const shape = strokes.find(s => s.id === shapeId)
    if (shape && (shape.tool === 'text' || shape.tool === 'sticky')) {
      const absPos = target.getAbsolutePosition()
      setEditingId(shape.id)
      setTextEditValue(shape.text || '')
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
    // Spacebar pan mode
    if (spacebarPressedRef.current) {
      const stage = stageRef.current;
      isPanningRef.current = true;
      const pos = stage.getPointerPosition();
      panStartRef.current = { x: pos.x, y: pos.y };
      stagePosAtPanStartRef.current = { x: stage.x(), y: stage.y() };
      return;
    }

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
      let clickedId = e.target.id()
      if (!clickedId && e.target.getParent()?.className === 'Group') {
        clickedId = e.target.getParent()?.id()
      }
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
      const point = getRelativePointerPosition(stage)

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
      setUndoStack(prev => [...prev, { type: 'create', id: newShape.id, shape: newShape }])
      setRedoStack([])

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

    // Drawing history added upon mouseUp completion

    const stage = stageRef.current
    const pointerPosition = getRelativePointerPosition(stage)

    if (tool === 'laser') {
      setLocalLaser([pointerPosition.x, pointerPosition.y])
      return
    }

    const effectiveColor = tool === 'eraser' ? '#ffffff' : color; // Color doesn't matter for destination-out, but keep it visible if fallbacks happen
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
        tool: tool, // Keep 'eraser' as 'eraser' for true erasing
        points: [pointerPosition.x, pointerPosition.y],
      }
    } else if (tool === 'rect') {
      newShape = {
        ...newShape,
        x: pointerPosition.x,
        y: pointerPosition.y,
        width: 0,
        height: 0,
        ...(isFilled ? { fillColor: color } : {}),
      }
    } else if (tool === 'circle') {
      newShape = {
        ...newShape,
        x: pointerPosition.x,
        y: pointerPosition.y,
        radius: 0,
        ...(isFilled ? { fillColor: color } : {}),
      }
    } else if (tool === 'arrow') {
      newShape = {
        ...newShape,
        points: [pointerPosition.x, pointerPosition.y, pointerPosition.x, pointerPosition.y],
      }
    } else if (tool === 'sticky') {
      newShape = {
        ...newShape,
        x: pointerPosition.x,
        y: pointerPosition.y,
        width: 150,
        height: 150,
        text: 'Sticky Note',
        fontSize: 16,
        color: '#333',
        fillColor: color, // Uses the selected color for the sticky background
      }
    }

    setStrokes((prev) => [...prev, newShape])
  }

  const handleMouseMove = (e) => {
    const stage = stageRef.current
    if (!stage) return
    const point = getRelativePointerPosition(stage)

    // Spacebar pan
    if (isPanningRef.current && spacebarPressedRef.current) {
      const pos = stage.getPointerPosition();
      const dx = pos.x - panStartRef.current.x;
      const dy = pos.y - panStartRef.current.y;
      setStagePos({
        x: stagePosAtPanStartRef.current.x + dx,
        y: stagePosAtPanStartRef.current.y + dy,
      });
      return;
    }

    // Emit cursor position with a 40ms throttle
    const now = Date.now()
    if (socket && now - lastCursorEmitRef.current > 40) {
      socket.emit('cursor:move', { roomId, x: point.x, y: point.y })
      lastCursorEmitRef.current = now
    }

    if (!isDrawing) return
    if (tool === 'select') return // Do nothing for drawing if selecting
    if (tool === 'text') return

    if (tool === 'laser') {
      setLocalLaser(prev => {
        const next = [...prev, point.x, point.y]
        if (socket && now - lastCursorEmitRef.current > 40) {
           socket.emit('laser:update', { roomId, points: next })
        }
        return next
      })
      return
    }

    setStrokes((prev) => {
      const strokesCopy = [...prev]
      const lastStroke = strokesCopy[strokesCopy.length - 1]
      if (!lastStroke) return strokesCopy

      if (lastStroke.tool === 'pen' || lastStroke.tool === 'eraser') {
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('image', file);
      try {
        const backendUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:7860';
        const response = await fetch(`${backendUrl}/upload`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const data = await response.json();
        if (data.url) {
          const imageUrl = data.url;
          const stage = stageRef.current;
          let point = { x: dimensions.width / 2, y: dimensions.height / 2 };
          if (stage) {
             const centerPos = { x: dimensions.width / 2, y: dimensions.height / 2 };
             point = {
                x: (centerPos.x - stage.x()) / stage.scaleX(),
                y: (centerPos.y - stage.y()) / stage.scaleY()
             };
          }

          const newShape = {
            id: crypto.randomUUID(),
            tool: 'image',
            x: point.x,
            y: point.y,
            image: imageUrl,
          }

          setStrokes(prev => [...prev, newShape])
          setUndoStack(prev => [...prev, { type: 'create', id: newShape.id, shape: newShape }])
          setRedoStack([])

          if (socket) {
            socket.emit('stroke:created', { roomId, stroke: newShape })
          }

          setTool('select')
        }
      } catch (err) {
        console.error('Image upload failed', err);
        alert('Image upload failed');
      }
      
      // Clear the input so the same file can be selected again
      if (e.target) {
        e.target.value = '';
      }
    }
  }

  const fileInputRef = useRef(null)
  const projectInputRef = useRef(null)

  useEffect(() => {
    if (tool === 'image' && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [tool])


  const handleMouseUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    if (tool === 'select') return
    if (tool === 'text') return

    setIsDrawing(false)

    if (tool === 'laser') {
      setLocalLaser([])
      if (socket) {
        socket.emit('laser:clear', { roomId })
      }
      return
    }

    setStrokes((prev) => {
      const strokesCopy = [...prev]
      const lastStroke = strokesCopy[strokesCopy.length - 1]
      if (lastStroke) {
        if (socket) {
          socket.emit('stroke:created', { roomId, stroke: lastStroke })
        }
        setUndoStack(prevUndo => [...prevUndo, { type: 'create', id: lastStroke.id, shape: lastStroke }])
        setRedoStack([])
      }
      return strokesCopy
    })
  }

  // --- Transformation Handlers ---

  const handleDragEnd = (e) => {
    const id = e.target.id()
    if (!id) return

    const shape = strokes.find(s => s.id === id)
    if (!shape) return

    const newAttrs = {
      x: e.target.x(),
      y: e.target.y()
    }

    const updatedShape = { ...shape, ...newAttrs }
    
    setUndoStack(prev => [...prev, { type: 'update', id: shape.id, oldShape: shape, newShape: updatedShape }])
    setRedoStack([])

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

    setUndoStack(prev => [...prev, { type: 'update', id: shape.id, oldShape: shape, newShape: updatedShape }])
    setRedoStack([])

    setStrokes(prev => prev.map(s => s.id === id ? updatedShape : s))

    if (socket) {
      socket.emit('shape:update', { roomId, shape: updatedShape })
    }
  }



  const handleWheel = (e) => {
    e.evt.preventDefault()

    const scaleBy = 1.05
    const stage = e.target.getStage()
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    // Determine zoom direction
    let direction = e.evt.deltaY > 0 ? -1 : 1
    if (e.evt.ctrlKey) {
      direction = -direction // Trackpad pinch
    }

    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    if (newScale < 0.1 || newScale > 10) return

    setStageScale(newScale)
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }

  const handleClear = () => {
    if (!window.confirm("Are you sure you want to clear the entire collaborative board? This action is permanent!")) return;

    setStrokes([])
    setUndoStack([])
    setRedoStack([])
    setSelectedId(null)

    if (socket) {
      socket.emit('board:clear', { roomId })
    }
  }

  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  const handleUndo = () => {
    if (undoStack.length === 0) return

    const lastAction = undoStack[undoStack.length - 1]
    const remainingUndo = undoStack.slice(0, undoStack.length - 1)
    setUndoStack(remainingUndo)

    if (lastAction.type === 'create') {
      setStrokes(prev => prev.filter(s => s.id !== lastAction.id))
      if (socket) {
        socket.emit('shape:delete', { roomId, shapeId: lastAction.id })
      }
      setRedoStack(prev => [...prev, lastAction])
    } else if (lastAction.type === 'update') {
      setStrokes(prev => prev.map(s => s.id === lastAction.id ? lastAction.oldShape : s))
      if (socket) {
        socket.emit('shape:update', { roomId, shape: lastAction.oldShape })
      }
      setRedoStack(prev => [...prev, lastAction])
    } else if (lastAction.type === 'delete') {
      setStrokes(prev => [...prev, lastAction.shape])
      if (socket) {
        socket.emit('stroke:created', { roomId, stroke: lastAction.shape })
      }
      setRedoStack(prev => [...prev, lastAction])
    }
    setSelectedId(null)
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return

    const nextAction = redoStack[redoStack.length - 1]
    const remainingRedo = redoStack.slice(0, redoStack.length - 1)
    setRedoStack(remainingRedo)

    if (nextAction.type === 'create') {
      setStrokes(prev => [...prev, nextAction.shape])
      if (socket) {
        socket.emit('stroke:created', { roomId, stroke: nextAction.shape })
      }
      setUndoStack(prev => [...prev, nextAction])
    } else if (nextAction.type === 'update') {
      setStrokes(prev => prev.map(s => s.id === nextAction.id ? nextAction.newShape : s))
      if (socket) {
        socket.emit('shape:update', { roomId, shape: nextAction.newShape })
      }
      setUndoStack(prev => [...prev, nextAction])
    } else if (nextAction.type === 'delete') {
      setStrokes(prev => prev.filter(s => s.id !== nextAction.id))
      if (socket) {
        socket.emit('shape:delete', { roomId, shapeId: nextAction.id })
      }
      setUndoStack(prev => [...prev, nextAction])
    }
    setSelectedId(null)
  }

  // Keyboard Shortcuts Effect
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (textEditVisible) return; // Don't trigger shortcuts while typing text

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Tool selection shortcuts
      switch (e.key.toLowerCase()) {
        case 'p': setTool('pen'); break;
        case 'v': setTool('select'); break;
        case 't': setTool('text'); break;
        case 'e': setTool('eraser'); break;
        case 'h': setTool('hand'); break;
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [textEditVisible, handleUndo, handleRedo, setTool]);

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

  const handleExportPDF = () => {
    if (!stageRef.current) return;

    const stage = stageRef.current;
    // Export at 2x resolution for sharpness
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const stageWidth = stage.width();
    const stageHeight = stage.height();

    // Use landscape if wider than tall
    const orientation = stageWidth >= stageHeight ? 'l' : 'p';
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [stageWidth, stageHeight],
      hotfixes: ['px_scaling'],
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, stageWidth, stageHeight);
    pdf.save(`syncboard-${roomId || 'board'}.pdf`);
  };

  const handleLockRoom = () => {
    const pin = prompt('Enter a 4-digit PIN to lock the room:');
    if (!pin || pin.length !== 4) {
      alert('Invalid PIN. Room lock canceled (PIN must be 4 characters).');
      return;
    }
    if (socket) {
      socket.emit('room:lock', { roomId, passcode: pin });
    }
  }

  const handleExportProject = () => {
    const dataStr = JSON.stringify(strokes);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `syncboard-${roomId || 'project'}.syncboard`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
  }

  const handleImportProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedStrokes = JSON.parse(event.target.result);
        if (Array.isArray(parsedStrokes)) {
          setStrokes(parsedStrokes);
          setUndoStack([]);
          setRedoStack([]);
          setSelectedId(null);
          if (socket) {
            socket.emit('board:snapshot', { roomId, strokes: parsedStrokes });
          }
        } else {
          alert('Invalid project file format.');
        }
      } catch (err) {
        console.error('Error parsing project file:', err);
        alert('Failed to read project file.');
      }
    };
    reader.readAsText(file);

    if (e.target) {
      e.target.value = '';
    }
  }

  // Touch handlers for pinch-to-zoom
  const handleTouchMove = (e) => {
    e.evt.preventDefault();
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    // Two-finger pinch
    if (touch1 && touch2) {
      const stage = stageRef.current;
      if (!stage) return;

      const dist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      if (lastDistRef.current === null) {
        lastDistRef.current = dist;
        return;
      }

      const scaleFactor = dist / lastDistRef.current;
      lastDistRef.current = dist;

      const oldScale = stage.scaleX();
      const newScale = Math.min(10, Math.max(0.1, oldScale * scaleFactor));

      // Pinch center point
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      const mousePointTo = {
        x: (centerX - stage.x()) / oldScale,
        y: (centerY - stage.y()) / oldScale,
      };

      setStageScale(newScale);
      setStagePos({
        x: centerX - mousePointTo.x * newScale,
        y: centerY - mousePointTo.y * newScale,
      });
    } else {
      // Single finger — treat as normal mouse move
      lastDistRef.current = null;
      handleMouseMove(e);
    }
  };

  const handleTouchEnd = () => {
    lastDistRef.current = null;
    handleMouseUp();
  };

  return (
    <div className="relative flex flex-col h-full bg-slate-950">
      <UsersSidebar connectedUsers={connectedUsers} socketId={socket?.id} />

      <Toolbar
        tool={tool}
        setTool={setTool}
        setSelectedId={setSelectedId}
        isFilled={isFilled}
        setIsFilled={setIsFilled}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        handleClear={handleClear}
        handleExport={handleExport}
        handleExportPDF={handleExportPDF}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        fileInputRef={fileInputRef}
        handleImageUpload={handleImageUpload}
        onLockClick={handleLockRoom}
        handleExportProject={handleExportProject}
        handleImportProject={handleImportProject}
        projectInputRef={projectInputRef}
        isHost={isHost}
      />

      <div className="relative flex-1 bg-slate-900 bg-dot-pattern overflow-hidden m-4 mt-0 rounded-2xl border border-slate-700/50 shadow-[inset_0_4px_30px_rgba(0,0,0,0.5)]">
        {/* Connection Status Indicator */}
        <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-xs font-medium shadow-lg select-none">
          <span className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
            connectionStatus === 'reconnecting' ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]' :
            'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
          }`} />
          <span className="text-slate-300">
            {connectionStatus === 'connected' ? 'Live Sync' :
             connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
          </span>
        </div>

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
            className="text-xl p-0 m-0 overflow-hidden bg-transparent outline-none resize-none z-50 font-sans leading-none border border-cyan-500 rounded text-cyan-400"
            autoFocus
          />
        )}

        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height - 140}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          draggable={tool === 'hand'}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setStagePos({ x: e.target.x(), y: e.target.y() })
            }
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDblClick={handleTextDblClick}
          style={{ cursor: spacebarPressedRef.current ? 'grab' : (tool === 'hand' ? 'grab' : 'crosshair') }}
        >
          <Layer>
            {strokes.map((shape) => {
              const isSelected = shape.id === selectedId
              const commonProps = {
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

              if (shape.tool === 'pen' || shape.tool === 'eraser') {
                return (
                  <Line
                    key={shape.id}
                    {...commonProps}
                    points={shape.points}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    hitStrokeWidth={25}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={shape.tool === 'eraser' ? 'destination-out' : 'source-over'}
                  />
                )
              }

              if (shape.tool === 'rect') {
                return (
                  <Rect
                    key={shape.id}
                    {...commonProps}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    fill={shape.fillColor}
                  />
                )
              }

              if (shape.tool === 'circle') {
                return (
                  <Circle
                    key={shape.id}
                    {...commonProps}
                    radius={shape.radius}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    fill={shape.fillColor}
                  />
                )
              }

              if (shape.tool === 'text') {
                // Hide text if it is being edited to avoid duplication
                if (shape.id === editingId) return null;

                return (
                  <Text
                    key={shape.id}
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
                    key={shape.id}
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
                    key={shape.id}
                    {...commonProps}
                    src={shape.image}
                  />
                )
              }

              if (shape.tool === 'sticky') {
                return (
                  <Group key={shape.id} {...commonProps} id={shape.id}>
                    <Rect
                      id={shape.id}
                      width={shape.width}
                      height={shape.height}
                      fill={shape.fillColor}
                      shadowColor="rgba(0,0,0,0.3)"
                      shadowBlur={10}
                      shadowOffset={{ x: 3, y: 3 }}
                    />
                    <Text
                      id={shape.id}
                      text={shape.id === editingId ? '' : (shape.text || 'Sticky Note')}
                      width={shape.width - 20}
                      height={shape.height - 20}
                      x={10}
                      y={10}
                      fontSize={shape.fontSize || 16}
                      fill={shape.color || '#333'}
                      fontFamily="sans-serif"
                    />
                  </Group>
                )
              }

              return null
            })}

            {/* Transformer */}
            <TransformerComponent selectedShape={strokes.find(s => s.id === selectedId)} />

          </Layer>

          {/* Remote Cursors & Lasers Layer */}
          <Layer>
            {/* Lasers */}
            {localLaser.length > 0 && (
              <Line
                points={localLaser}
                stroke="red"
                strokeWidth={4}
                shadowColor="red"
                shadowBlur={10}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation="source-over"
              />
            )}
            {Object.keys(remoteLasers).map(socketId => {
              const laser = remoteLasers[socketId]
              return (
                <Line
                  key={`laser-${socketId}`}
                  points={laser.points}
                  stroke={laser.color || 'red'}
                  strokeWidth={4}
                  shadowColor={laser.color || 'red'}
                  shadowBlur={10}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              )
            })}

            {/* Remote Selections */}
            {Object.values(remoteSelections).map((selection, i) => {
              const shape = strokes.find(s => s.id === selection.shapeId);
              if (!shape) return null;

              let bx = shape.x || 0;
              let by = shape.y || 0;
              let bw = shape.width || 0;
              let bh = shape.height || 0;

              if (shape.tool === 'circle') {
                const r = shape.radius || 0;
                bx = bx - r;
                by = by - r;
                bw = r * 2;
                bh = r * 2;
              } else if (shape.tool === 'pen' || shape.tool === 'eraser' || shape.tool === 'arrow') {
                if (shape.points && shape.points.length >= 2) {
                  let minX = shape.points[0], maxX = shape.points[0];
                  let minY = shape.points[1], maxY = shape.points[1];
                  for (let idx = 0; idx < shape.points.length; idx += 2) {
                    const px = shape.points[idx];
                    const py = shape.points[idx + 1];
                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;
                  }
                  bx = minX;
                  by = minY;
                  bw = maxX - minX;
                  bh = maxY - minY;
                }
              }

              // Apply scale to dimensions
              bw *= (shape.scaleX || 1);
              bh *= (shape.scaleY || 1);

              return (
                <Rect
                  key={`selection-${selection.shapeId}-${i}`}
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  stroke={selection.color}
                  strokeWidth={2}
                  dash={[5, 5]}
                  rotation={shape.rotation || 0}
                  listening={false}
                />
              );
            })}

            {/* Cursors */}
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
