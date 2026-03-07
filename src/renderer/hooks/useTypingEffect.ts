import { useState, useEffect } from 'react'

interface UseTypingEffectOptions {
  speed?: number
  delay?: number
  loop?: boolean
  onComplete?: () => void
}

export function useTypingEffect(
  text: string,
  options: UseTypingEffectOptions = {}
) {
  const { speed = 50, delay = 0, loop = false, onComplete } = options
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    setDisplayedText('')
    setIsComplete(false)

    const startTimeout = setTimeout(() => {
      setIsTyping(true)
      let currentIndex = 0

      const typeInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1))
          currentIndex++
        } else {
          clearInterval(typeInterval)
          setIsTyping(false)
          setIsComplete(true)
          onComplete?.()

          if (loop) {
            setTimeout(() => {
              setDisplayedText('')
              setIsComplete(false)
            }, 1000)
          }
        }
      }, speed)

      return () => clearInterval(typeInterval)
    }, delay)

    return () => clearTimeout(startTimeout)
  }, [text, speed, delay, loop, onComplete])

  return { displayedText, isTyping, isComplete }
}
