import { useState, useRef, useCallback, ReactNode, useEffect } from 'react'
import './ResizablePanel.css'

type ResizeDirection = 'right' | 'bottom' | 'left' | 'top' | 'corner'

interface ResizablePanelProps {
  children: ReactNode
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  resizable?: ResizeDirection[]
  className?: string
}

export function ResizablePanel({
  children,
  defaultWidth,
  defaultHeight,
  minWidth = 100,
  maxWidth = Infinity,
  minHeight = 100,
  maxHeight = Infinity,
  resizable = ['right', 'bottom', 'corner'],
  className = ''
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [height, setHeight] = useState(defaultHeight)
  const [isDragging, setIsDragging] = useState<ResizeDirection | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const handleMouseDown = useCallback((direction: ResizeDirection, e: React.MouseEvent) => {
    e.preventDefault()
    if (!panelRef.current) return

    const rect = panelRef.current.getBoundingClientRect()
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height
    }
    setIsDragging(direction)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - startPos.current.x
    const deltaY = e.clientY - startPos.current.y

    if (isDragging === 'right' || isDragging === 'corner') {
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startPos.current.width + deltaX))
      setWidth(newWidth)
    }

    if (isDragging === 'left') {
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startPos.current.width - deltaX))
      setWidth(newWidth)
    }

    if (isDragging === 'bottom' || isDragging === 'corner') {
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startPos.current.height + deltaY))
      setHeight(newHeight)
    }

    if (isDragging === 'top') {
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startPos.current.height - deltaY))
      setHeight(newHeight)
    }
  }, [isDragging, minWidth, maxWidth, minHeight, maxHeight])

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const classes = [
    'resizable-panel',
    isDragging && 'resizable-panel-dragging',
    className
  ].filter(Boolean).join(' ')

  const style: React.CSSProperties = {}
  if (width !== undefined) style.width = width
  if (height !== undefined) style.height = height

  return (
    <div ref={panelRef} className={classes} style={style}>
      <div className="resizable-panel-content">
        {children}
      </div>
      {resizable.includes('right') && (
        <div
          className="resizable-handle resizable-handle-right"
          onMouseDown={(e) => handleMouseDown('right', e)}
        />
      )}
      {resizable.includes('bottom') && (
        <div
          className="resizable-handle resizable-handle-bottom"
          onMouseDown={(e) => handleMouseDown('bottom', e)}
        />
      )}
      {resizable.includes('left') && (
        <div
          className="resizable-handle resizable-handle-left"
          onMouseDown={(e) => handleMouseDown('left', e)}
        />
      )}
      {resizable.includes('top') && (
        <div
          className="resizable-handle resizable-handle-top"
          onMouseDown={(e) => handleMouseDown('top', e)}
        />
      )}
      {resizable.includes('corner') && (
        <div
          className="resizable-handle resizable-handle-corner"
          onMouseDown={(e) => handleMouseDown('corner', e)}
        />
      )}
    </div>
  )
}
