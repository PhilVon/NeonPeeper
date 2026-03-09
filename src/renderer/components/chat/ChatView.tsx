import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useChatStore } from '../../store/chat-store'
import { usePeerStore } from '../../store/peer-store'
import { useMediaStore } from '../../store/media-store'
import { useEmojiStore } from '../../store/emoji-store'
import { ChatHeader } from './ChatHeader'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { FileTransferProgress } from './FileTransferProgress'
import { TypingIndicator } from './TypingIndicator'
import { SplitPane } from '../layout/SplitPane'
import { ChatVideoPanel } from '../media/ChatVideoPanel'
import { ScreenSourcePicker } from '../media/ScreenSourcePicker'
import { useUIStore } from '../../store/ui-store'
import { getPersistenceManager } from '../../services/PersistenceManager'
import { getConnectionManager } from '../../services/ConnectionManager'
import { getCryptoManager } from '../../services/CryptoManager'
import { getFileTransferManager } from '../../services/FileTransferManager'
import { getMediaManager } from '../../services/MediaManager'
import { getEphemeralMessageManager } from '../../services/EphemeralMessageManager'
import { getCommunityClient } from '../../services/CommunityClient'
import { useSettingsStore } from '../../store/settings-store'
import { useCommunityStore } from '../../store/community-store'
import { createMessage, PROTOCOL_CONSTANTS } from '../../types/protocol'
import type { GifMeta } from '../../types/protocol'
import { toast } from '../../store/toast-store'
import type { Chat, ChatMessage as ChatMessageType } from '../../types/chat'
import { CommunityBanner } from '../community/CommunityBanner'
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

  const isCommunity = chat.type === 'community'
  // Parse community info from chatId: "community:serverId:channelId"
  const communityParts = isCommunity ? chat.id.split(':') : null
  const communityServerId = communityParts?.[1] || ''
  const communityChannelId = communityParts?.[2] || ''
  const communityServer = useCommunityStore((s) => isCommunity ? s.servers.get(communityServerId) : undefined)
  const communityChannels = useCommunityStore((s) => isCommunity ? s.channels.get(communityServerId) : undefined)
  const communityChannel = communityChannels?.find((c) => c.id === communityChannelId)

  // History for community chats is sent by the server on CHANNEL_JOIN,
  // so no explicit request is needed here.

  const isLocalSharing = useMediaStore((s) => s.videoSharingChatIds.has(chat.id))
  const chatParticipants = useMediaStore((s) => s.chatVideoParticipants.get(chat.id))
  const localScreenStream = useMediaStore((s) => s.localScreenStream)
  const remoteScreenStreams = useMediaStore((s) => s.remoteScreenStreams)
  const hasScreenShareForChat = localScreenStream !== null ||
    (isCommunity
      ? remoteScreenStreams.size > 0
      : Array.from(remoteScreenStreams.keys()).some((pid) => chat.members.includes(pid)))
  const hasVideoActivity = isLocalSharing || (chatParticipants?.size ?? 0) > 0 || hasScreenShareForChat

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Mark as read when chat becomes active
  useEffect(() => {
    useChatStore.getState().markAsRead(chat.id)
  }, [chat.id])

  // Auto read receipts via IntersectionObserver
  const sentReadReceipts = useRef(new Set<string>())
  const windowFocused = useUIStore((s) => s.windowFocused)

  // Build a map of unread peer messages for quick lookup
  const unreadPeerMessages = useMemo(() => {
    const map = new Map<string, { from: string }>()
    for (const m of messages) {
      if (m.from !== localId && m.status !== 'read') {
        map.set(m.id, { from: m.from })
      }
    }
    return map
  }, [messages, localId])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const sendReadReceipt = (messageId: string, from: string) => {
      if (sentReadReceipts.current.has(messageId)) return
      sentReadReceipts.current.add(messageId)
      const cm = getConnectionManager()
      const ackMsg = createMessage('TEXT_ACK', localId, from, {
        messageId,
        status: 'read',
      }, chat.id)
      cm.sendMessage(from, ackMsg)
      useChatStore.getState().updateMessageStatus(messageId, chat.id, 'read')
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!useUIStore.getState().windowFocused) return
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          const msgId = el.dataset.messageId
          if (!msgId) continue
          const info = unreadPeerMessages.get(msgId)
          if (info) {
            sendReadReceipt(msgId, info.from)
          }
        }
      },
      { root: container, threshold: 0.5 }
    )

    // Observe all message elements
    const messageEls = container.querySelectorAll('[data-message-id]')
    messageEls.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [chat.id, localId, unreadPeerMessages])

  // Re-check visible messages when window regains focus
  useEffect(() => {
    if (!windowFocused) return
    const container = messagesContainerRef.current
    if (!container) return

    const messageEls = container.querySelectorAll('[data-message-id]')
    const containerRect = container.getBoundingClientRect()
    const cm = getConnectionManager()

    messageEls.forEach((el) => {
      const rect = el.getBoundingClientRect()
      const visible = rect.top < containerRect.bottom && rect.bottom > containerRect.top
      if (!visible) return
      const msgId = (el as HTMLElement).dataset.messageId
      if (!msgId || sentReadReceipts.current.has(msgId)) return
      const info = unreadPeerMessages.get(msgId)
      if (info) {
        sentReadReceipts.current.add(msgId)
        const ackMsg = createMessage('TEXT_ACK', localId, info.from, {
          messageId: msgId,
          status: 'read',
        }, chat.id)
        cm.sendMessage(info.from, ackMsg)
        useChatStore.getState().updateMessageStatus(msgId, chat.id, 'read')
      }
    })
  }, [windowFocused, chat.id, localId, unreadPeerMessages])

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
    async (content: string, contentType?: 'text' | 'gif', meta?: GifMeta) => {
      if (contentType !== 'gif' && content.length > PROTOCOL_CONSTANTS.MAX_TEXT_LENGTH) {
        toast.error(`Message too long (max ${PROTOCOL_CONSTANTS.MAX_TEXT_LENGTH} characters)`)
        return
      }

      // Resolve custom emojis from content
      let customEmojis: import('../../types/emoji').EmbeddedEmoji[] | undefined
      if (contentType !== 'gif') {
        const shortcodeMatches = content.match(/:([a-zA-Z0-9_]{2,32}):/g)
        if (shortcodeMatches) {
          const resolved = new Map<string, string>()
          for (const match of shortcodeMatches) {
            const code = match.slice(1, -1)
            if (resolved.has(code)) continue
            const emoji = useEmojiStore.getState().getEmojiByShortcode(code)
            if (emoji) {
              resolved.set(code, emoji.dataUrl)
            }
          }
          if (resolved.size > 0) {
            if (resolved.size > 8) {
              toast.error('Maximum 8 custom emojis per message')
              return
            }
            customEmojis = Array.from(resolved.entries()).map(([shortcode, dataUrl]) => ({
              shortcode,
              dataUrl,
            }))
          }
        }
      }

      // Community chat: send via CommunityClient
      if (isCommunity) {
        getCommunityClient().sendTextMessage(communityServerId, communityChannelId, content, {
          replyTo: replyTo?.id,
          contentType,
          meta: meta as Record<string, unknown> | undefined,
          customEmojis,
        })
        setReplyTo(null)
        return
      }

      const messageId = uuidv4()
      const now = Date.now()
      const ttl = useSettingsStore.getState().messageAutoDeleteTtl

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
        customEmojis,
        ...(ttl > 0 ? { ttl } : {}),
      }

      // Check total message size
      const testPayload = JSON.stringify(chatMessage)
      if (testPayload.length > PROTOCOL_CONSTANTS.MAX_MESSAGE_SIZE) {
        toast.error('Message too large (including emoji images)')
        return
      }

      useChatStore.getState().addMessage(chatMessage)
      if (ttl > 0) {
        getEphemeralMessageManager().scheduleDelete(messageId, chat.id, now, ttl)
      }
      setReplyTo(null)

      getPersistenceManager().storeMessage({
        ...chatMessage,
        status: 'sent',
      }).catch(() => {})

      const cm = getConnectionManager()
      const crypto = getCryptoManager()
      const e2eEnabled = useSettingsStore.getState().e2eEncryption

      for (const memberId of chat.members) {
        if (memberId === localId) continue

        let encrypted: { ciphertext: string; iv: string } | undefined
        if (e2eEnabled && crypto.hasSharedKey(memberId) && contentType !== 'gif') {
          try {
            encrypted = await crypto.encryptPayload(memberId, content)
          } catch {
            // Send unencrypted on failure
          }
        }

        const msg = createMessage('TEXT', localId, memberId, {
          content: encrypted ? '' : content,
          replyTo: replyTo?.id,
          contentType,
          meta,
          customEmojis,
          encrypted,
          ...(ttl > 0 ? { ttl } : {}),
        }, chat.id)
        ;(msg as { id: string }).id = messageId

        cm.sendMessage(memberId, msg).then((sent) => {
          if (sent) {
            useChatStore.getState().updateMessageStatus(messageId, chat.id, 'sent')
          }
        })
      }

      // Mark local message as encrypted if we encrypted it
      if (e2eEnabled && chat.members.some((m) => m !== localId && crypto.hasSharedKey(m))) {
        useChatStore.getState().updateMessageEncrypted(messageId, chat.id)
      }
    },
    [chat, localId, replyTo, isCommunity, communityServerId, communityChannelId]
  )

  const handleTyping = useCallback(() => {
    if (isCommunity) {
      getCommunityClient().sendTypingStart(communityServerId, communityChannelId)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        getCommunityClient().sendTypingStop(communityServerId, communityChannelId)
      }, PROTOCOL_CONSTANTS.TYPING_DEBOUNCE_MS)
      return
    }

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
  }, [chat, localId, isCommunity, communityServerId, communityChannelId])

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

    if (isCommunity) {
      getCommunityClient().sendEdit(communityServerId, communityChannelId, messageId, content)
      return
    }

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

    if (isCommunity) {
      getCommunityClient().sendDelete(communityServerId, communityChannelId, messageId)
      return
    }

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

  const handleAttachFile = useCallback((file: File) => {
    // Send file to first connected member
    const targetPeer = chat.members.find(
      (m) => m !== localId && getConnectionManager().isConnected(m)
    )
    if (!targetPeer) {
      toast.error('No connected peer to send file to')
      return
    }
    getFileTransferManager().offerFile(targetPeer, chat.id, file)
  }, [chat, localId])

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

  // Community media handlers
  const handleCommunityStartVideo = useCallback(async () => {
    await getCommunityClient().startCommunityVoice(communityServerId, communityChannelId, true)
  }, [communityServerId, communityChannelId])

  const handleCommunityStartAudio = useCallback(async () => {
    await getCommunityClient().startCommunityVoice(communityServerId, communityChannelId, false)
  }, [communityServerId, communityChannelId])

  const handleCommunityStopMedia = useCallback(() => {
    getCommunityClient().stopCommunityVoice(communityServerId, communityChannelId)
  }, [communityServerId, communityChannelId])

  const isGroup = chat.type === 'group' || isCommunity
  const isConnected = isCommunity
    ? getCommunityClient().isConnected(communityServerId)
    : chat.members.some((m) => m !== localId && getConnectionManager().isConnected(m))

  const chatContent = (
    <div className="chat-view-chat-pane">
      <ChatHeader
        chat={chat}
        onToggleVideo={isCommunity ? (isLocalSharing ? handleCommunityStopMedia : handleCommunityStartVideo) : handleHeaderToggleVideo}
        onToggleAudio={isCommunity ? (isLocalSharing ? handleCommunityStopMedia : handleCommunityStartAudio) : handleHeaderToggleAudio}
        isVideoActive={isLocalSharing}
        isCommunity={isCommunity}
        communityServerId={communityServerId}
        communityChannelId={communityChannelId}
      />
      {isCommunity && communityServer && communityChannel && (
        <CommunityBanner
          serverName={communityServer.serverName}
          channelName={communityChannel.name}
        />
      )}
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
      {!isCommunity && <FileTransferProgress chatId={chat.id} />}
      <ChatInput
        onSend={handleSend}
        onTyping={handleTyping}
        onAttachFile={isCommunity ? undefined : handleAttachFile}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onConfirmEdit={handleConfirmEdit}
        disabled={!isConnected}
        isCommunityChat={isCommunity}
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
            onStartSharing={isCommunity ? handleCommunityStartVideo : handleStartVideoSharing}
            onStopSharing={isCommunity ? handleCommunityStopMedia : handleStopVideoSharing}
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
