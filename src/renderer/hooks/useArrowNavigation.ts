import { useCallback, useRef } from 'react'

interface UseArrowNavigationOptions {
  /** CSS selector for focusable items within the container */
  selector?: string
  /** Whether to wrap around at boundaries */
  wrap?: boolean
  /** Orientation for arrow key handling */
  orientation?: 'vertical' | 'horizontal' | 'both'
}

export function useArrowNavigation({
  selector = '[role="option"], [role="tab"], [role="menuitem"], button, a',
  wrap = true,
  orientation = 'vertical',
}: UseArrowNavigationOptions = {}) {
  const containerRef = useRef<HTMLElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const container = containerRef.current
      if (!container) return

      const items = Array.from(container.querySelectorAll<HTMLElement>(selector))
        .filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)

      if (items.length === 0) return

      const currentIndex = items.indexOf(document.activeElement as HTMLElement)
      let nextIndex = -1

      const isNext =
        (orientation !== 'horizontal' && e.key === 'ArrowDown') ||
        (orientation !== 'vertical' && e.key === 'ArrowRight')
      const isPrev =
        (orientation !== 'horizontal' && e.key === 'ArrowUp') ||
        (orientation !== 'vertical' && e.key === 'ArrowLeft')

      if (isNext) {
        e.preventDefault()
        if (currentIndex < items.length - 1) {
          nextIndex = currentIndex + 1
        } else if (wrap) {
          nextIndex = 0
        }
      } else if (isPrev) {
        e.preventDefault()
        if (currentIndex > 0) {
          nextIndex = currentIndex - 1
        } else if (wrap) {
          nextIndex = items.length - 1
        }
      } else if (e.key === 'Home') {
        e.preventDefault()
        nextIndex = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        nextIndex = items.length - 1
      }

      if (nextIndex >= 0 && nextIndex < items.length) {
        items[nextIndex].focus()
      }
    },
    [selector, wrap, orientation]
  )

  return { containerRef, handleKeyDown }
}
