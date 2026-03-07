import { useRef, useCallback, RefObject } from 'react'

interface UseReplayAnimationOptions {
  animationClass: string
}

interface UseReplayAnimationReturn<T extends HTMLElement> {
  ref: RefObject<T>
  replay: () => void
}

export function useReplayAnimation<T extends HTMLElement = HTMLDivElement>(
  options: UseReplayAnimationOptions
): UseReplayAnimationReturn<T> {
  const { animationClass } = options
  const ref = useRef<T>(null)

  const replay = useCallback(() => {
    const element = ref.current
    if (!element) return

    // Remove animation class, force reflow, re-add class
    element.classList.remove(animationClass)
    void element.offsetHeight // Force reflow
    element.classList.add(animationClass)
  }, [animationClass])

  return { ref, replay }
}
