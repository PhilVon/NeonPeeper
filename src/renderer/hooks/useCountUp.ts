import { useState, useEffect } from 'react'

interface UseCountUpOptions {
  duration?: number
  delay?: number
  decimals?: number
}

export function useCountUp(
  target: number,
  options: UseCountUpOptions = {}
) {
  const { duration = 2000, delay = 0, decimals = 0 } = options
  const [value, setValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    setValue(0)
    setIsComplete(false)

    const delayTimeout = setTimeout(() => {
      setIsAnimating(true)
      let startTime: number | null = null

      const easeOutQuad = (t: number) => t * (2 - t)

      const animate = (timestamp: number) => {
        if (startTime === null) startTime = timestamp
        const elapsed = timestamp - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easeOutQuad(progress)

        const currentValue = easedProgress * target
        setValue(Number(currentValue.toFixed(decimals)))

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setValue(Number(target.toFixed(decimals)))
          setIsAnimating(false)
          setIsComplete(true)
        }
      }

      requestAnimationFrame(animate)
    }, delay)

    return () => clearTimeout(delayTimeout)
  }, [target, duration, delay, decimals])

  return { value, isAnimating, isComplete }
}
