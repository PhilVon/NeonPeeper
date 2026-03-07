import { useRef, useEffect, useCallback, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useChatStore } from '../../store/chat-store'
import { usePeerStore } from '../../store/peer-store'
import { useMediaStore } from '../../store/media-store'
import { ChatHeader } from './ChatHeader'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { TypingIndicator } from './TypingIndicator'
import { SplitPane } from '../layout/SplitPane'
import { ChatVideoPanel } from '../media/ChatVideoPanel'
import { ScreenSourcePicker } from '../media/ScreenSourcePicker'
import { getPersistenceManager } from '../../services/PersistenceManager'
import { getConnectionManager } from '../../services/ConnectionManager'
import { getMediaManager } from '../../services/MediaManager'
import { createMessage, PROTOCOL_CONSTANTS } from '../../types/protocol'
import type { GifMeta } from '../../types/protocol'
import { toast } from '../../store/toast-store'
import type { Chat, ChatMessage as ChatMessageType } from '../../types/chat'
import './ChatView.css'

const EMPTY_MESSAGES: ChatMessageType[] = []

interface ChatViewProps {
  chat: Chat
}

export function ChatView({ chat }: ChatViewProps) {
  const messages = useChatStore((s) => s.messages.get(chat.id) ?? EMPTY_MESSAGES)
  const localId = usePeerStore.getState().localProfile?.id ?? ''
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null)
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showScreenPicker, setShowScreenPicker] = useState(false)

  const isLocalSharing = useMediaStore((s) => s.videoSharingChatIds.has(chat.id))
  const chatParticipants = useMediaStore((s) => s.chatVideoParticipants.get(chat.id))
  const localScreenStream = useMediaStore((s) => s.localScreenStream)
  const remoteScreenStreams = useMediaStore((s) => s.remoteScreenStreams)
  const hasScreenShareForChat = localScreenStream !== null ||
    Array.from(remoteScreenStreams.keys()).some((pid) => chat.members.includes(pid))
  const hasVideoActivity = isLocalSharing || (chatParticipants?.size ?? 0) > 0 || hasScreenShareForChat

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
    (content: string, contentType?: 'text' | 'gif', meta?: GifMeta) => {
      if (contentType !== 'gif' && content.length > PROTOCOL_CONSTANTS.MAX_TEXT_LENGTH) {
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
        contentType,
        meta,
      }

      useChatStore.getState().addMessage(chatMessage)
      setReplyTo(null)

      getPersistenceManager().storeMessage({
        ...chatMessage,
        status: 'sent',
      }).catch(() => {})

      const cm = getConnectionManager()
      for (const memberId of chat.members) {
        if (memberId === localId) continue

        const msg = createMessage('TEXT', localId, memberId, {
          content,
          replyTo: replyTo?.id,
          contentType,
          meta,
        }, chat.id)
        ;(msg as { id: string }).id = messageId

        cm.sendMessage(memberId, msg).then((sent) => {
          if (sent) {
            useChatStore.getState().updateMessageStatus(messageId, chat.id, 'sent')
          }
        })
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

  // --- Video sharing handlers ---

  const handleStartVideoSharing = useCallback(async () => {
    const mm = getMediaManager()
    const cm = getConnectionManager()

    try {
      await mm.startCamera()

      for (const memberId of chat.members) {
        if (memberId === localId) continue
        if (!cm.isConnected(memberId)) continue

        mm.addTracksToConnection(memberId)

        const pc = cm.getPeerConnection(memberId)
        if (pc) {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          const msg = createMessage('MEDIA_OFFER', localId, memberId, {
            sdp: offer.sdp!,
            mediaType: 'camera',
          }, chat.id)
          cm.sendMessage(memberId, msg)
        }
      }

      useMediaStore.getState().setVideoEnabled(true)
      useMediaStore.getState().startSharingInChat(chat.id)
      useMediaStore.getState().addChatVideoParticipant(chat.id, localId)
    } catch (err) {
      console.error('Failed to start video sharing:', err)
      toast.error('Failed to start video. Check camera permissions.')
      mm.stopCamera()
    }
  }, [chat, localId])

  const handleStartAudioSharing = useCallback(async () => {
    const mm = getMediaManager()
    const cm = getConnectionManager()

    try {
      await mm.startMicOnly()

      for (const memberId of chat.members) {
        if (memberId === localId) continue
        if (!cm.isConnected(memberId)) continue

        mm.addTracksToConnection(memberId)

        const pc = cm.getPeerConnection(memberId)
        if (pc) {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          const msg = createMessage('MEDIA_OFFER', localId, memberId, {
            sdp: offer.sdp!,
            mediaType: 'audio',
          }, chat.id)
          cm.sendMessage(memberId, msg)
        }
      }

      useMediaStore.getState().startSharingInChat(chat.id)
      useMediaStore.getState().addChatVideoParticipant(chat.id, localId)
      useMediaStore.getState().setVideoEnabled(false)
    } catch (err) {
      console.error('Failed to start audio sharing:', err)
      toast.error('Failed to start audio. Check microphone permissions.')
      mm.stopCamera()
    }
  }, [chat, localId])

  const handleStopVideoSharing = useCallback(() => {
    const mm = getMediaManager()
    const cm = getConnectionManager()

    for (const memberId of chat.members) {
      if (memberId === localId) continue
      if (!cm.isConnected(memberId)) continue

      mm.removeTracksFromConnection(memberId)

      const msg = createMessage('MEDIA_STOP', localId, memberId, {
        mediaType: 'camera',
        trackId: '',
      }, chat.id)
      cm.sendMessage(memberId, msg)
    }

    useMediaStore.getState().stopSharingInChat(chat.id)
    useMediaStore.getState().removeChatVideoParticipant(chat.id, localId)

    // Only stop camera if not sharing in any other chat
    const remaining = useMediaStore.getState().videoSharingChatIds
    if (remaining.size === 0) {
      mm.stopCamera()
    }
  }, [chat, localId])

  const handleToggleAudio = useCallback(() => {
    getMediaManager().toggleAudio()
  }, [])

  const handleToggleVideo = useCallback(async () => {
    await getMediaManager().toggleVideo()
  }, [])

  const handleToggleScreenShare = useCallback(() => {
    const mm = getMediaManager()
    if (useMediaStore.getState().localScreenStream) {
      mm.stopScreenShare(chat.id)
    } else {
      setShowScreenPicker(true)
    }
  }, [chat.id])

  const handleSelectScreenSource = useCallback(async (sourceId: string) => {
    try {
      await getMediaManager().startScreenShare(sourceId, chat.id)
    } catch (err) {
      console.error('Failed to start screen share:', err)
    }
  }, [chat.id])

  const handleHeaderToggleAudio = useCallback(() => {
    if (isLocalSharing) {
      handleStopVideoSharing()
    } else {
      handleStartAudioSharing()
    }
  }, [isLocalSharing, handleStopVideoSharing, handleStartAudioSharing])

  const handleHeaderToggleVideo = useCallback(() => {
    if (isLocalSharing) {
      handleStopVideoSharing()
    } else {
      handleStartVideoSharing()
    }
  }, [isLocalSharing, handleStopVideoSharing, handleStartVideoSharing])

  const isGroup = chat.type === 'group'
  const isConnected = chat.members.some(
    (m) => m !== localId && getConnectionManager().isConnected(m)
  )

  const chatContent = (
    <div className="chat-view-chat-pane">
      <ChatHeader
        chat={chat}
        onToggleVideo={handleHeaderToggleVideo}
        onToggleAudio={handleHeaderToggleAudio}
        isVideoActive={isLocalSharing}
      />
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

  return (
    <div className="chat-view">
      {hasVideoActivity ? (
        <SplitPane direction="horizontal" defaultSize={60} minSize={30} maxSize={80}>
          {chatContent}
          <ChatVideoPanel
            chatId={chat.id}
            onStartSharing={handleStartVideoSharing}
            onStopSharing={handleStopVideoSharing}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
          />
        </SplitPane>
      ) : (
        chatContent
      )}
      <ScreenSourcePicker
        isOpen={showScreenPicker}
        onClose={() => setShowScreenPicker(false)}
        onSelect={handleSelectScreenSource}
      />
    </div>
  )
}
