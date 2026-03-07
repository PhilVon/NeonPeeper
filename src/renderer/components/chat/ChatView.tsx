import { useRef, useEffect, useCallback, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useChatStore } from '../../store/chat-store'
import { usePeerStore } from '../../store/peer-store'
import { ChatHeader } from './ChatHeader'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { TypingIndicator } from './TypingIndicator'
import { getPersistenceManager } from '../../services/PersistenceManager'
import { getConnectionManager } from '../../services/ConnectionManager'
import { createMessage, PROTOCOL_CONSTANTS } from '../../types/protocol'
import { toast } from '../../store/toast-store'
import type { Chat, ChatMessage as ChatMessageType } from '../../types/chat'
import './ChatView.css'

const EMPTY_MESSAGES: ChatMessageType[] = []

interface ChatViewProps {
  chat: Chat
  onCallClick?: () => void
  onVideoClick?: () => void
}

export function ChatView({ chat, onCallClick, onVideoClick }: ChatViewProps) {
  const messages = useChatStore((s) => s.messages.get(chat.id) ?? EMPTY_MESSAGES)
  const localId = usePeerStore.getState().localProfile?.id ?? ''
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null)
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Mark as read when chat becomes active
  useEffect(() => {
    useChatStore.getState().markAsRead(chat.id)
  }, [chat.id])

  // Send read receipts for unread messages
  useEffect(() => {
    const cm = getConnectionManager()
    const unreadMessages = messages.filter(
      (m) => m.from !== localId && m.status !== 'read'
    )
    for (const msg of unreadMessages) {
      const ackMsg = createMessage('TEXT_ACK', localId, msg.from, {
        messageId: msg.id,
        status: 'read',
      }, chat.id)
      cm.sendMessage(msg.from, ackMsg)
    }
  }, [chat.id, messages.length, localId])

  // Scroll-up pagination
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    if (container.scrollTop === 0 && messages.length >= 50) {
      const oldest = messages[0]
      if (oldest) {
        getPersistenceManager()
          .getMessages(chat.id, 50, oldest.timestamp)
          .then((older) => {
            if (older.length > 0) {
              const mapped: ChatMessageType[] = older.map((m) => ({
                ...m,
                status: m.status ?? 'read',
              }))
              useChatStore.getState().loadOlderMessages(chat.id, mapped)
            }
          })
          .catch(() => {})
      }
    }
  }, [chat.id, messages])

  const handleSend = useCallback(
    (content: string) => {
      if (content.length > PROTOCOL_CONSTANTS.MAX_TEXT_LENGTH) {
        toast.error(`Message too long (max ${PROTOCOL_CONSTANTS.MAX_TEXT_LENGTH} characters)`)
        return
      }

      const messageId = uuidv4()
      const now = Date.now()

      const chatMessage: ChatMessageType = {
        id: messageId,
        chatId: chat.id,
        from: localId,
        content,
        timestamp: now,
        status: 'sending',
        replyTo: replyTo?.id,
      }

      // Add to store
      useChatStore.getState().addMessage(chatMessage)
      setReplyTo(null)

      // Persist
      getPersistenceManager().storeMessage({
        ...chatMessage,
        status: 'sent',
      }).catch(() => {})

      // Send to peers
      const cm = getConnectionManager()
      for (const memberId of chat.members) {
        if (memberId === localId) continue

        const msg = createMessage('TEXT', localId, memberId, {
          content,
          replyTo: replyTo?.id,
        }, chat.id)
        // Use the same message ID for dedup
        ;(msg as { id: string }).id = messageId

        const sent = cm.sendMessage(memberId, msg)
        if (sent) {
          useChatStore.getState().updateMessageStatus(messageId, chat.id, 'sent')
        }
      }
    },
    [chat, localId, replyTo]
  )

  const handleTyping = useCallback(() => {
    const cm = getConnectionManager()
    for (const memberId of chat.members) {
      if (memberId === localId) continue
      const msg = createMessage('TYPING_START', localId, memberId, {}, chat.id)
      cm.sendEphemeral(memberId, msg)
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      for (const memberId of chat.members) {
        if (memberId === localId) continue
        const cm = getConnectionManager()
        const msg = createMessage('TYPING_STOP', localId, memberId, {}, chat.id)
        cm.sendEphemeral(memberId, msg)
      }
    }, PROTOCOL_CONSTANTS.TYPING_DEBOUNCE_MS)
  }, [chat, localId])

  const handleReply = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId)
    if (msg) setReplyTo({ id: msg.id, content: msg.content })
  }

  const handleEdit = (messageId: string, content: string) => {
    setEditingMessage({ id: messageId, content })
  }

  const handleConfirmEdit = (messageId: string, content: string) => {
    useChatStore.getState().editMessage(messageId, chat.id, content, Date.now())
    setEditingMessage(null)

    // Send edit to peers
    const cm = getConnectionManager()
    for (const memberId of chat.members) {
      if (memberId === localId) continue
      const msg = createMessage('TEXT_EDIT', localId, memberId, {
        messageId,
        content,
        editedAt: Date.now(),
      }, chat.id)
      cm.sendMessage(memberId, msg)
    }

    getPersistenceManager().updateMessageContent(messageId, content, Date.now()).catch(() => {})
  }

  const handleDelete = (messageId: string) => {
    useChatStore.getState().deleteMessage(messageId, chat.id)

    const cm = getConnectionManager()
    for (const memberId of chat.members) {
      if (memberId === localId) continue
      const msg = createMessage('TEXT_DELETE', localId, memberId, { messageId }, chat.id)
      cm.sendMessage(memberId, msg)
    }

    getPersistenceManager().markMessageDeleted(messageId).catch(() => {})
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {})
  }

  const isGroup = chat.type === 'group'
  const isConnected = chat.members.some(
    (m) => m !== localId && getConnectionManager().isConnected(m)
  )

  return (
    <div className="chat-view">
      <ChatHeader chat={chat} onCallClick={onCallClick} onVideoClick={onVideoClick} />
      <div
        className="chat-view-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            showSender={isGroup}
            onReply={handleReply}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCopy={handleCopy}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <TypingIndicator chatId={chat.id} />
      <ChatInput
        onSend={handleSend}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onConfirmEdit={handleConfirmEdit}
        disabled={!isConnected}
      />
    </div>
  )
}
