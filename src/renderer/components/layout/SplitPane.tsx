import { useState, useRef, useCallback, ReactNode, useEffect } from 'react'
import './SplitPane.css'

interface SplitPaneProps {
  direction?: 'horizontal' | 'vertical'
  defaultSize?: number
  minSize?: number
  maxSize?: number
  children: [ReactNode, ReactNode]
  className?: string
}

export function SplitPane({
  direction = 'horizontal',
  defaultSize = 50,
  minSize = 10,
  maxSize = 90,
  children,
  className = ''
}: SplitPaneProps) {
  const [size, setSize] = useState(defaultSize)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    let newSize: number

    if (direction === 'horizontal') {
      newSize = ((e.clientX - rect.left) / rect.width) * 100
    } else {
      newSize = ((e.clientY - rect.top) / rect.height) * 100
    }

    newSize = Math.max(minSize, Math.min(maxSize, newSize))
    setSize(newSize)
  }, [isDragging, direction, minSize, maxSize])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp, direction])

  const classes = [
    'split-pane',
    `split-pane-${direction}`,
    isDragging && 'split-pane-dragging',
    className
  ].filter(Boolean).join(' ')

  const firstPaneStyle = direction === 'horizontal'
    ? { width: `${size}%` }
    : { height: `${size}%` }

  const secondPaneStyle = direction === 'horizontal'
    ? { width: `${100 - size}%` }
    : { height: `${100 - size}%` }

  return (
    <div ref={containerRef} className={classes}>
      <div className="split-pane-panel" style={firstPaneStyle}>
        {children[0]}
      </div>
      <div
        className="split-pane-divider"
        onMouseDown={handleMouseDown}
      >
        <div className="split-pane-divider-handle" />
      </div>
      <div className="split-pane-panel" style={secondPaneStyle}>
        {children[1]}
      </div>
    </div>
  )
}
