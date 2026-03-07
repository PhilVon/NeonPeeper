import { useEffect, useState } from 'react'
import { useChatStore } from '../../store/chat-store'
import { usePeerStore } from '../../store/peer-store'
import { PROTOCOL_CONSTANTS } from '../../types/protocol'
import './TypingIndicator.css'

interface TypingIndicatorProps {
  chatId: string
}

export function TypingIndicator({ chatId }: TypingIndicatorProps) {
  const typingMap = useChatStore((s) => s.typing.get(chatId))
  const peers = usePeerStore((s) => s.peers)
  const localId = usePeerStore.getState().localProfile?.id
  const [, forceUpdate] = useState(0)

  // Auto-expire typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate((n) => n + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!typingMap || typingMap.size === 0) return null

  const now = Date.now()
  const activeTypers = Array.from(typingMap.entries())
    .filter(([peerId, timestamp]) => peerId !== localId && now - timestamp < PROTOCOL_CONSTANTS.TYPING_EXPIRE_MS)
    .map(([peerId]) => peers.get(peerId)?.displayName || peerId.slice(0, 8))

  if (activeTypers.length === 0) return null

  let text: string
  if (activeTypers.length === 1) {
    text = `${activeTypers[0]} is typing...`
  } else if (activeTypers.length === 2) {
    text = `${activeTypers[0]} and ${activeTypers[1]} are typing...`
  } else {
    text = `${activeTypers.length} people are typing...`
  }

  return (
    <div className="typing-indicator">
      <div className="typing-indicator-dots">
        <span className="typing-indicator-dot" />
        <span className="typing-indicator-dot" />
        <span className="typing-indicator-dot" />
      </div>
      <span className="typing-indicator-text">{text}</span>
    </div>
  )
}
