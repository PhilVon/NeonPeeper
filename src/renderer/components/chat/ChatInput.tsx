import { useState, useRef, useCallback, useEffect } from 'react'
import { NeonButton } from '../ui/NeonButton'
import { EmojiPickerPopup } from './EmojiPickerPopup'
import { GiphySearchPanel } from './GiphySearchPanel'
import { CustomEmojiPicker } from './CustomEmojiPicker'
import type { GifMeta } from '../../types/protocol'
import './ChatInput.css'

interface ChatInputProps {
  onSend: (content: string, contentType?: 'text' | 'gif', meta?: GifMeta) => void
  onTyping?: () => void
  onAttachFile?: (file: File) => void
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
  onAttachFile,
  replyTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onConfirmEdit,
  disabled = false,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPanel, setShowGifPanel] = useState(false)
  const [showCustomEmojiPicker, setShowCustomEmojiPicker] = useState(false)
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

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.slice(0, start) + emoji + value.slice(end)
      setValue(newValue)
      // Set cursor position after inserted emoji
      requestAnimationFrame(() => {
        textarea.focus()
        const pos = start + emoji.length
        textarea.setSelectionRange(pos, pos)
      })
    } else {
      setValue((v) => v + emoji)
    }
    setShowEmojiPicker(false)
  }, [value])

  const handleToggleEmoji = useCallback(() => {
    setShowEmojiPicker((v) => !v)
    setShowGifPanel(false)
    setShowCustomEmojiPicker(false)
  }, [])

  const handleToggleGif = useCallback(() => {
    setShowGifPanel((v) => !v)
    setShowEmojiPicker(false)
    setShowCustomEmojiPicker(false)
  }, [])

  const handleToggleCustomEmoji = useCallback(() => {
    setShowCustomEmojiPicker((v) => !v)
    setShowEmojiPicker(false)
    setShowGifPanel(false)
  }, [])

  const handleCustomEmojiSelect = useCallback((shortcode: string) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.slice(0, start) + shortcode + value.slice(end)
      setValue(newValue)
      requestAnimationFrame(() => {
        textarea.focus()
        const pos = start + shortcode.length
        textarea.setSelectionRange(pos, pos)
      })
    } else {
      setValue((v) => v + shortcode)
    }
    setShowCustomEmojiPicker(false)
  }, [value])

  const handleSelectGif = useCallback((url: string, meta: GifMeta) => {
    onSend(url, 'gif', meta)
    setShowGifPanel(false)
  }, [onSend])

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
        {onAttachFile && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onAttachFile(file)
                e.target.value = ''
              }}
            />
            <button
              className="chat-input-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              title="Attach file"
            >
              +
            </button>
          </>
        )}
        <button
          className={['chat-input-icon-btn', showEmojiPicker && 'chat-input-icon-btn-active'].filter(Boolean).join(' ')}
          onClick={handleToggleEmoji}
          disabled={disabled}
          title="Emoji"
        >
          ☺
        </button>
        <button
          className={['chat-input-icon-btn', showGifPanel && 'chat-input-icon-btn-active'].filter(Boolean).join(' ')}
          onClick={handleToggleGif}
          disabled={disabled}
          title="GIF"
        >
          GIF
        </button>
        <button
          className={['chat-input-icon-btn', showCustomEmojiPicker && 'chat-input-icon-btn-active'].filter(Boolean).join(' ')}
          onClick={handleToggleCustomEmoji}
          disabled={disabled}
          title="Custom Emoji"
        >
          *
        </button>
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          aria-label="Message input"
        />
        <NeonButton
          size="small"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
        >
          {editingMessage ? 'Save' : 'Send'}
        </NeonButton>
      </div>
      <EmojiPickerPopup
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={handleEmojiSelect}
      />
      <GiphySearchPanel
        isOpen={showGifPanel}
        onClose={() => setShowGifPanel(false)}
        onSelectGif={handleSelectGif}
      />
      <CustomEmojiPicker
        isOpen={showCustomEmojiPicker}
        onClose={() => setShowCustomEmojiPicker(false)}
        onSelect={handleCustomEmojiSelect}
      />
    </div>
  )
}
