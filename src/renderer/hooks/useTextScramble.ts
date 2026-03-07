import { useState, useEffect, useCallback } from 'react'

interface UseTextScrambleOptions {
  speed?: number
  delay?: number
  characters?: string
}

export function useTextScramble(
  text: string,
  options: UseTextScrambleOptions = {}
) {
  const {
    speed = 30,
    delay = 0,
    characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  } = options

  const [displayedText, setDisplayedText] = useState('')
  const [isScrambling, setIsScrambling] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [replayCount, setReplayCount] = useState(0)

  const replay = useCallback(() => {
    setReplayCount((c) => c + 1)
  }, [])

  useEffect(() => {
    setDisplayedText('')
    setIsComplete(false)

    const startTimeout = setTimeout(() => {
      setIsScrambling(true)
      let resolvedCount = 0

      const scrambleInterval = setInterval(() => {
        if (resolvedCount < text.length) {
          const resolved = text.slice(0, resolvedCount + 1)
          const remaining = Array.from({ length: text.length - resolvedCount - 1 }, () =>
            characters[Math.floor(Math.random() * characters.length)]
          ).join('')
          setDisplayedText(resolved + remaining)
          resolvedCount++
        } else {
          clearInterval(scrambleInterval)
          setIsScrambling(false)
          setIsComplete(true)
        }
      }, speed)

      return () => clearInterval(scrambleInterval)
    }, delay)

    return () => clearTimeout(startTimeout)
  }, [text, speed, delay, characters, replayCount])

  return { displayedText, isScrambling, isComplete, replay }
}
