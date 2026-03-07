import { useState, useRef } from 'react'
import { usePeerStore } from '../../store/peer-store'
import { Avatar } from '../ui/Avatar'
import { GifMessage } from './GifMessage'
import { useClickOutside } from '../../hooks/useClickOutside'
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import './ChatMessage.css'

interface ChatMessageProps {
  message: ChatMessageType
  showSender?: boolean
  onReply?: (messageId: string) => void
  onEdit?: (messageId: string, content: string) => void
  onDelete?: (messageId: string) => void
  onCopy?: (content: string) => void
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getStatusIcon(status: ChatMessageType['status']): string {
  switch (status) {
    case 'sending': return '...'
    case 'sent': return ''
    case 'delivered': return '✓'
    case 'read': return '✓✓'
  }
}

export function ChatMessage({
  message,
  showSender = false,
  onReply,
  onEdit,
  onDelete,
  onCopy,
}: ChatMessageProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const localId = usePeerStore.getState().localProfile?.id
  const isOwn = message.from === localId
  const peer = usePeerStore((s) => s.peers.get(message.from))
  const isGif = message.contentType === 'gif'

  useClickOutside(menuRef, () => setShowMenu(false), showMenu)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowMenu(true)
  }

  if (message.deleted) {
    return (
      <div className={`chat-message ${isOwn ? 'chat-message-own' : ''}`}>
        <div className="chat-message-bubble chat-message-deleted">
          <span className="chat-message-deleted-text">Message deleted</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`chat-message ${isOwn ? 'chat-message-own' : ''}`}>
      {showSender && !isOwn && (
        <Avatar name={peer?.displayName || '?'} size="small" />
      )}
      <div className="chat-message-content" onContextMenu={handleContextMenu}>
        {showSender && !isOwn && (
          <span className="chat-message-sender">
            {peer?.displayName || message.from.slice(0, 8)}
          </span>
        )}
        {message.replyTo && (
          <div className="chat-message-reply-ref">
            Reply
          </div>
        )}
        <div className="chat-message-bubble">
          {isGif ? (
            <GifMessage url={message.content} meta={message.meta} />
          ) : (
            <span className="chat-message-text">{message.content}</span>
          )}
          <span className="chat-message-meta">
            {message.edited && <span className="chat-message-edited">edited</span>}
            <span className="chat-message-time">{formatTime(message.timestamp)}</span>
            {isOwn && (
              <span className="chat-message-status">{getStatusIcon(message.status)}</span>
            )}
          </span>
        </div>
        {showMenu && (
          <div ref={menuRef} className="chat-message-context-menu">
            {onReply && (
              <button onClick={() => { onReply(message.id); setShowMenu(false) }}>
                Reply
              </button>
            )}
            {isOwn && onEdit && !isGif && (
              <button onClick={() => { onEdit(message.id, message.content); setShowMenu(false) }}>
                Edit
              </button>
            )}
            {isOwn && onDelete && (
              <button onClick={() => { onDelete(message.id); setShowMenu(false) }}>
                Delete
              </button>
            )}
            {onCopy && (
              <button onClick={() => { onCopy(message.content); setShowMenu(false) }}>
                Copy
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
