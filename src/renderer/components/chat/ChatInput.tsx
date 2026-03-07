import { useState, useRef, useCallback, useEffect } from 'react'
import { NeonButton } from '../ui/NeonButton'
import './ChatInput.css'

interface ChatInputProps {
  onSend: (content: string) => void
  onTyping?: () => void
  replyTo?: { id: string; content: string } | null
  onCancelReply?: () => void
  editingMessage?: { id: string; content: string } | null
  onCancelEdit?: () => void
  onConfirmEdit?: (messageId: string, content: string) => void
  disabled?: boolean
}

export function ChatInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onConfirmEdit,
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When editing starts, populate textarea
  useEffect(() => {
    if (editingMessage) {
      setValue(editingMessage.content)
      textareaRef.current?.focus()
    }
  }, [editingMessage])

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)

      // Auto-resize
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        const maxHeight = 6 * 20 // ~6 rows
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px'
      }

      // Typing indicator with debounce
      if (onTyping) {
        onTyping()
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          // Typing stopped — handled by parent
        }, 3000)
      }
    },
    [onTyping]
  )

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return

    if (editingMessage && onConfirmEdit) {
      onConfirmEdit(editingMessage.id, trimmed)
    } else {
      onSend(trimmed)
    }
    setValue('')

    // Reset textarea height
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
    }
  }, [value, editingMessage, onConfirmEdit, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      if (editingMessage && onCancelEdit) {
        onCancelEdit()
        setValue('')
      } else if (replyTo && onCancelReply) {
        onCancelReply()
      }
    }
  }

  return (
    <div className="chat-input">
      {replyTo && (
        <div className="chat-input-reply">
          <span className="chat-input-reply-label">Replying to:</span>
          <span className="chat-input-reply-content">{replyTo.content.slice(0, 80)}</span>
          <button className="chat-input-reply-cancel" onClick={onCancelReply}>×</button>
        </div>
      )}
      {editingMessage && (
        <div className="chat-input-reply chat-input-editing">
          <span className="chat-input-reply-label">Editing message</span>
          <button className="chat-input-reply-cancel" onClick={onCancelEdit}>×</button>
        </div>
      )}
      <div className="chat-input-bar">
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
        />
        <NeonButton
          size="small"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
        >
          {editingMessage ? 'Save' : 'Send'}
        </NeonButton>
      </div>
    </div>
  )
}
