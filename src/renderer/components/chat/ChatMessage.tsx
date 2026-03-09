import { useState, useRef } from 'react'
import { usePeerStore } from '../../store/peer-store'
import { Avatar } from '../ui/Avatar'
import { GifMessage } from './GifMessage'
import { useClickOutside } from '../../hooks/useClickOutside'
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import type { EmbeddedEmoji } from '../../types/emoji'
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
    case 'sending': return '◷'
    case 'sent': return '✓'
    case 'delivered': return '✓✓'
    case 'read': return '✓✓'
  }
}

function formatTtl(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`
  return `${Math.round(ms / 86_400_000)}d`
}

function isValidEmojiDataUrl(url: string): boolean {
  return /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/.test(url)
}

function renderMessageContent(content: string, customEmojis?: EmbeddedEmoji[]): React.ReactNode {
  if (!customEmojis || customEmojis.length === 0) {
    return content
  }

  const emojiMap = new Map(
    customEmojis
      .filter((e) => isValidEmojiDataUrl(e.dataUrl))
      .map((e) => [e.shortcode, e.dataUrl])
  )
  const parts: React.ReactNode[] = []
  const regex = /:([a-zA-Z0-9_]{2,32}):/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(content)) !== null) {
    const shortcode = match[1]
    const dataUrl = emojiMap.get(shortcode)

    if (dataUrl) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index))
      }
      parts.push(
        <img
          key={key++}
          src={dataUrl}
          alt={`:${shortcode}:`}
          title={`:${shortcode}:`}
          className="chat-message-custom-emoji"
        />
      )
      lastIndex = match.index + match[0].length
    }
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : content
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
    <div
      className={`chat-message ${isOwn ? 'chat-message-own' : ''}`}
      data-message-id={message.id}
      role="article"
      aria-label={`${isOwn ? 'You' : peer?.displayName || 'Unknown'} at ${formatTime(message.timestamp)}`}
    >
      {showSender && !isOwn && (
        <Avatar name={peer?.displayName || '?'} src={peer?.avatarDataUrl} size="small" />
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
            <span className="chat-message-text">{renderMessageContent(message.content, message.customEmojis)}</span>
          )}
          <span className="chat-message-meta">
            {message.ttl && message.ttl > 0 && (
              <span className="chat-message-ephemeral" title={`Auto-deletes after ${formatTtl(message.ttl)}`}>&#9203;</span>
            )}
            {message.encrypted && <span className="chat-message-encrypted" title="End-to-end encrypted">&#128274;</span>}
            {message.edited && <span className="chat-message-edited">edited</span>}
            <span className="chat-message-time">{formatTime(message.timestamp)}</span>
            {isOwn && (
              <span className={`chat-message-status chat-message-status-${message.status}`}>{getStatusIcon(message.status)}</span>
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
