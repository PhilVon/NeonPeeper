import { ReactNode, useState, useRef, HTMLAttributes } from 'react'
import { Portal } from '../utils/Portal'
import './Tooltip.css'

interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  content: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  children: ReactNode
}

export function Tooltip({
  content,
  position = 'top',
  delay = 200,
  children,
  className = '',
  ...props
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const newCoords = calculatePosition(rect, position)
        setCoords(newCoords)
        setVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  const calculatePosition = (rect: DOMRect, pos: string) => {
    const gap = 8
    switch (pos) {
      case 'bottom':
        return { top: rect.bottom + gap, left: rect.left + rect.width / 2 }
      case 'left':
        return { top: rect.top + rect.height / 2, left: rect.left - gap }
      case 'right':
        return { top: rect.top + rect.height / 2, left: rect.right + gap }
      case 'top':
      default:
        return { top: rect.top - gap, left: rect.left + rect.width / 2 }
    }
  }

  const classes = [
    'tooltip-wrapper',
    className
  ].filter(Boolean).join(' ')

  return (
    <>
      <div
        ref={triggerRef}
        className={classes}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        {...props}
      >
        {children}
      </div>
      {visible && (
        <Portal>
          <div
            className={`tooltip tooltip-${position}`}
            style={{ top: coords.top, left: coords.left }}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  )
}
