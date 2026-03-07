import {
  type AnyNeonP2PMessage,
  type MessageType,
  type NeonP2PMessage,
  PROTOCOL_VERSION,
  PROTOCOL_CONSTANTS,
  ERROR_CODES,
  createMessage,
} from '../types/protocol'
import { usePeerStore } from '../store/peer-store'
import { useConnectionStore } from '../store/connection-store'
import { useChatStore } from '../store/chat-store'
import { useMediaStore } from '../store/media-store'
import { getConnectionManager } from './ConnectionManager'
import { getMediaManager } from './MediaManager'
import { getCryptoManager } from './CryptoManager'
import { getSignalingClient } from './SignalingClient'
import { getPersistenceManager } from './PersistenceManager'
import { generateDirectChatId } from '../types/chat'
import { toast } from '../store/toast-store'
import type { ChatMessage } from '../types/chat'

type MessageHandler<T extends MessageType = MessageType> = (
  message: NeonP2PMessage<T>,
  peerId: string
) => void

export class MessageRouter {
  private handlers = new Map<MessageType, MessageHandler[]>()
  private seenMessageIds = new Set<string>()

  constructor() {
    // Register built-in Phase 1 handlers
    this.registerHandler('HELLO', this.handleHello.bind(this))
    this.registerHandler('HELLO_ACK', this.handleHelloAck.bind(this))
    this.registerHandler('PING', this.handlePing.bind(this))
    this.registerHandler('PONG', this.handlePong.bind(this))
    this.registerHandler('DISCONNECT', this.handleDisconnect.bind(this))
    this.registerHandler('ERROR', this.handleError.bind(this))

    // Phase 2: Chat message handlers
    this.registerHandler('TEXT', this.handleText.bind(this))
    this.registerHandler('TEXT_ACK', this.handleTextAck.bind(this))
    this.registerHandler('TEXT_EDIT', this.handleTextEdit.bind(this))
    this.registerHandler('TEXT_DELETE', this.handleTextDelete.bind(this))
    this.registerHandler('TYPING_START', this.handleTypingStart.bind(this))
    this.registerHandler('TYPING_STOP', this.handleTypingStop.bind(this))

    // Phase 6: Chat session handlers
    this.registerHandler('CHAT_CREATE', this.handleChatCreate.bind(this))
    this.registerHandler('CHAT_INVITE', this.handleChatInvite.bind(this))
    this.registerHandler('CHAT_JOIN', this.handleChatJoin.bind(this))
    this.registerHandler('CHAT_LEAVE', this.handleChatLeave.bind(this))
    this.registerHandler('CHAT_SYNC', this.handleChatSync.bind(this))
    this.registerHandler('STATUS_UPDATE', this.handleStatusUpdate.bind(this))

    // Phase 4: Media handlers
    this.registerHandler('MEDIA_OFFER', this.handleMediaOffer.bind(this))
    this.registerHandler('MEDIA_ANSWER', this.handleMediaAnswer.bind(this))
    this.registerHandler('MEDIA_ICE', this.handleMediaIce.bind(this))
    this.registerHandler('MEDIA_START', this.handleMediaStart.bind(this))
    this.registerHandler('MEDIA_STOP', this.handleMediaStop.bind(this))
    this.registerHandler('MEDIA_QUALITY', this.handleMediaQuality.bind(this))
  }

  registerHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type)!.push(handler as MessageHandler)
  }

  // Called when raw data arrives from a DataChannel
  async routeMessage(peerId: string, rawData: string): Promise<void> {
    let message: AnyNeonP2PMessage
    try {
      message = JSON.parse(rawData)
    } catch {
      console.warn('[MessageRouter] Invalid JSON from', peerId)
      this.sendError(peerId, ERROR_CODES.INVALID_FORMAT, 'Invalid JSON')
      return
    }

    // Validate version
    if (message.version !== PROTOCOL_VERSION) {
      console.warn('[MessageRouter] Version mismatch:', message.version)
      if (message.type !== 'ERROR') {
        this.sendError(peerId, ERROR_CODES.UNSUPPORTED_VERSION, `Unsupported version: ${message.version}`, message.id)
      }
      return
    }

    // Deduplicate
    if (this.seenMessageIds.has(message.id)) {
      return
    }
    this.seenMessageIds.add(message.id)

    // Prune dedup set
    if (this.seenMessageIds.size > PROTOCOL_CONSTANTS.DEDUP_HISTORY_SIZE) {
      const entries = Array.from(this.seenMessageIds)
      const toRemove = entries.slice(0, entries.length - PROTOCOL_CONSTANTS.DEDUP_PRUNE_SIZE)
      for (const id of toRemove) {
        this.seenMessageIds.delete(id)
      }
    }

    // Verify signature if present
    if (message.signature) {
      const peer = usePeerStore.getState().peers.get(message.from)
      if (peer?.publicKey) {
        try {
          const valid = await getCryptoManager().verifySignature(
            message as unknown as Record<string, unknown>,
            message.signature,
            peer.publicKey
          )
          if (!valid) {
            console.warn('[MessageRouter] Invalid signature from', peerId)
            if (message.type !== 'ERROR') {
              this.sendError(peerId, ERROR_CODES.INVALID_SIGNATURE, 'Invalid message signature', message.id)
            }
            return
          }
        } catch {
          // Verification failed — allow unsigned for backward compat
        }
      }
    }

    // Dispatch to handlers
    const handlers = this.handlers.get(message.type)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message, peerId)
        } catch (err) {
          console.error(`[MessageRouter] Handler error for ${message.type}:`, err)
        }
      }
    } else {
      console.warn('[MessageRouter] No handler for type:', message.type)
      if (message.type !== 'ERROR') {
        this.sendError(peerId, ERROR_CODES.UNKNOWN_TYPE, `Unknown message type: ${message.type}`, message.id)
      }
    }
  }

  // --- Error sending ---

  private sendError(peerId: string, code: number, errorMessage: string, relatedMessageId?: string): void {
    const localId = usePeerStore.getState().localProfile?.id
    if (!localId) return
    const msg = createMessage('ERROR', localId, peerId, {
      code,
      message: errorMessage,
      ...(relatedMessageId ? { relatedMessageId } : {}),
    })
    getConnectionManager().sendMessage(peerId, msg)
  }

  // --- Built-in handlers ---

  private handleHello(message: NeonP2PMessage<'HELLO'>, peerId: string): void {
    const payload = message.payload
    const peerStore = usePeerStore.getState()
    const now = Date.now()

    // Store peer profile
    peerStore.upsertPeer({
      id: message.from,
      displayName: payload.displayName,
      publicKey: payload.publicKey,
      capabilities: payload.capabilities,
      firstSeen: now,
      lastSeen: now,
    })

    // TOFU key pinning
    if (payload.publicKey) {
      const { changed } = getCryptoManager().trustPeer(message.from, payload.publicKey)
      if (changed) {
        toast.warning(`Identity key changed for ${payload.displayName}! Possible impersonation.`)
      }
    }

    // Send HELLO_ACK
    const localProfile = peerStore.localProfile
    if (!localProfile) return

    const ackMsg = createMessage('HELLO_ACK', localProfile.id, message.from, {
      displayName: localProfile.displayName,
      publicKey: localProfile.publicKey,
      capabilities: localProfile.capabilities,
      ackedPeerId: message.from,
    })

    getConnectionManager().sendMessage(peerId, ackMsg)
    useConnectionStore.getState().setConnectionState(peerId, 'connected')
    useConnectionStore.getState().resetReconnectAttempts(peerId)
  }

  private handleHelloAck(message: NeonP2PMessage<'HELLO_ACK'>, peerId: string): void {
    const payload = message.payload
    const now = Date.now()

    usePeerStore.getState().upsertPeer({
      id: message.from,
      displayName: payload.displayName,
      publicKey: payload.publicKey,
      capabilities: payload.capabilities,
      firstSeen: now,
      lastSeen: now,
    })

    // TOFU key pinning
    if (payload.publicKey) {
      const { changed } = getCryptoManager().trustPeer(message.from, payload.publicKey)
      if (changed) {
        toast.warning(`Identity key changed for ${payload.displayName}! Possible impersonation.`)
      }
    }

    useConnectionStore.getState().setConnectionState(peerId, 'connected')
    useConnectionStore.getState().resetReconnectAttempts(peerId)
  }

  private handlePing(message: NeonP2PMessage<'PING'>, peerId: string): void {
    const localProfile = usePeerStore.getState().localProfile
    if (!localProfile) return

    const pongMsg = createMessage('PONG', localProfile.id, message.from, {
      seq: message.payload.seq,
    })
    getConnectionManager().sendMessage(peerId, pongMsg)

    // Update last seen
    usePeerStore.getState().setPeerStatus(message.from, Date.now())
  }

  private handlePong(message: NeonP2PMessage<'PONG'>, peerId: string): void {
    getConnectionManager().handlePong(peerId, message.payload.seq)
    usePeerStore.getState().setPeerStatus(message.from, Date.now())
  }

  private handleDisconnect(message: NeonP2PMessage<'DISCONNECT'>, peerId: string): void {
    console.log(`[MessageRouter] Peer ${message.from} disconnected: ${message.payload.reason} (${message.payload.code})`)
    getConnectionManager().markUserInitiated(peerId)
    getConnectionManager().closeConnection(peerId)
  }

  private handleError(message: NeonP2PMessage<'ERROR'>, _peerId: string): void {
    console.error(`[MessageRouter] Error from ${message.from}: [${message.payload.code}] ${message.payload.message}`)
  }

  // --- Phase 2: Chat handlers ---

  private handleText(message: NeonP2PMessage<'TEXT'>, peerId: string): void {
    const localId = usePeerStore.getState().localProfile?.id
    if (!localId) return

    const chatId = message.chatId || generateDirectChatId(localId, message.from)

    // Ensure chat exists
    const chatStore = useChatStore.getState()
    if (!chatStore.chats.has(chatId)) {
      const peer = usePeerStore.getState().peers.get(message.from)
      chatStore.upsertChat({
        id: chatId,
        type: 'direct',
        name: null,
        members: [localId, message.from],
        state: 'active',
        lastActivity: message.timestamp,
        lastMessageId: null,
        lastMessagePreview: null,
        unreadCount: 0,
        createdAt: message.timestamp,
      })

      // Persist the chat
      getPersistenceManager().storeChat({
        id: chatId,
        type: 'direct',
        name: peer?.displayName ?? null,
        members: [localId, message.from],
        state: 'active',
        lastActivity: message.timestamp,
        lastMessageId: null,
        unreadCount: 0,
        createdAt: message.timestamp,
      }).catch(() => {})
    }

    // Store message
    const chatMessage: ChatMessage = {
      id: message.id,
      chatId,
      from: message.from,
      content: message.payload.content,
      timestamp: message.timestamp,
      status: 'delivered',
      replyTo: message.payload.replyTo,
      contentType: message.payload.contentType,
      meta: message.payload.meta,
    }

    chatStore.addMessage(chatMessage)
    getPersistenceManager().storeMessage(chatMessage).catch(() => {})

    // Send delivery ACK
    const ackMsg = createMessage('TEXT_ACK', localId, message.from, {
      messageId: message.id,
      status: 'delivered',
    }, chatId)
    getConnectionManager().sendMessage(peerId, ackMsg)
  }

  private handleTextAck(message: NeonP2PMessage<'TEXT_ACK'>, _peerId: string): void {
    const { messageId, status } = message.payload
    const chatId = message.chatId
    if (!chatId) return

    useChatStore.getState().updateMessageStatus(messageId, chatId, status)
    getPersistenceManager().updateMessageStatus(messageId, status).catch(() => {})
  }

  private handleTextEdit(message: NeonP2PMessage<'TEXT_EDIT'>, _peerId: string): void {
    const { messageId, content, editedAt } = message.payload
    const chatId = message.chatId
    if (!chatId) return

    useChatStore.getState().editMessage(messageId, chatId, content, editedAt)
    getPersistenceManager().updateMessageContent(messageId, content, editedAt).catch(() => {})
  }

  private handleTextDelete(message: NeonP2PMessage<'TEXT_DELETE'>, _peerId: string): void {
    const { messageId } = message.payload
    const chatId = message.chatId
    if (!chatId) return

    useChatStore.getState().deleteMessage(messageId, chatId)
    getPersistenceManager().markMessageDeleted(messageId).catch(() => {})
  }

  private handleTypingStart(message: NeonP2PMessage<'TYPING_START'>, _peerId: string): void {
    const chatId = message.chatId
    if (!chatId) return
    useChatStore.getState().setTyping(chatId, message.from, true)
  }

  private handleTypingStop(message: NeonP2PMessage<'TYPING_STOP'>, _peerId: string): void {
    const chatId = message.chatId
    if (!chatId) return
    useChatStore.getState().setTyping(chatId, message.from, false)
  }

  // --- Phase 4: Media handlers ---

  private handleMediaOffer(message: NeonP2PMessage<'MEDIA_OFFER'>, peerId: string): void {
    const cm = getConnectionManager()
    const pc = cm.getPeerConnection(peerId)
    if (!pc) return

    const chatId = message.chatId
    if (chatId) {
      useMediaStore.getState().addChatVideoParticipant(chatId, message.from)
    }

    pc.setRemoteDescription({ type: 'offer', sdp: message.payload.sdp })
      .then(() => pc.createAnswer())
      .then((answer) => {
        pc.setLocalDescription(answer)
        const localId = usePeerStore.getState().localProfile?.id ?? ''
        const answerMsg = createMessage('MEDIA_ANSWER', localId, message.from, {
          sdp: answer.sdp!,
        })
        cm.sendMessage(peerId, answerMsg)
      })
      .catch((err) => console.error('[MessageRouter] Media offer error:', err))
  }

  private handleMediaAnswer(message: NeonP2PMessage<'MEDIA_ANSWER'>, peerId: string): void {
    const pc = getConnectionManager().getPeerConnection(peerId)
    if (!pc) return
    pc.setRemoteDescription({ type: 'answer', sdp: message.payload.sdp })
      .catch((err) => console.error('[MessageRouter] Media answer error:', err))
  }

  private handleMediaIce(message: NeonP2PMessage<'MEDIA_ICE'>, peerId: string): void {
    const pc = getConnectionManager().getPeerConnection(peerId)
    if (!pc) return
    pc.addIceCandidate(message.payload.candidate)
      .catch((err) => console.error('[MessageRouter] Media ICE error:', err))
  }

  private handleMediaStart(message: NeonP2PMessage<'MEDIA_START'>, _peerId: string): void {
    console.log(`[MessageRouter] Peer ${message.from} started ${message.payload.mediaType}`)
    useMediaStore.getState().addPeerMediaType(message.from, message.payload.mediaType)
  }

  private handleMediaStop(message: NeonP2PMessage<'MEDIA_STOP'>, peerId: string): void {
    console.log(`[MessageRouter] Peer ${message.from} stopped ${message.payload.mediaType}`)
    useMediaStore.getState().removePeerMediaType(message.from, message.payload.mediaType)

    if (message.payload.mediaType === 'screen') {
      useMediaStore.getState().removeRemoteScreenStream(peerId)
      // Only remove from chat participants if peer has no other active media
      const remaining = useMediaStore.getState().peerMediaTypes[message.from] ?? []
      if (!remaining.includes('camera') && !remaining.includes('audio')) {
        const chatId = message.chatId
        if (chatId) {
          useMediaStore.getState().removeChatVideoParticipant(chatId, message.from)
        }
      }
      return
    }

    useMediaStore.getState().removeRemoteStream(peerId)

    const chatId = message.chatId
    if (chatId) {
      useMediaStore.getState().removeChatVideoParticipant(chatId, message.from)
    }
  }

  private handleMediaQuality(message: NeonP2PMessage<'MEDIA_QUALITY'>, peerId: string): void {
    const { direction, quality } = message.payload
    if (direction === 'request') {
      console.log(`[MessageRouter] Peer ${message.from} requesting quality: ${quality}`)
      getMediaManager().applyQualityPreset(quality, peerId)
      // Acknowledge with a notify
      const localId = usePeerStore.getState().localProfile?.id ?? ''
      const ack = createMessage('MEDIA_QUALITY', localId, message.from, {
        direction: 'notify',
        quality,
      })
      getConnectionManager().sendMessage(peerId, ack)
    } else if (direction === 'notify') {
      useMediaStore.getState().setCurrentQuality(quality)
    }
  }

  // --- Phase 6: Group chat handlers ---

  private handleChatCreate(message: NeonP2PMessage<'CHAT_CREATE'>, _peerId: string): void {
    const { chatId, type, name, members } = message.payload
    const chatStore = useChatStore.getState()

    if (!chatStore.chats.has(chatId)) {
      chatStore.upsertChat({
        id: chatId,
        type,
        name: name ?? null,
        members,
        state: 'active',
        lastActivity: message.timestamp,
        lastMessageId: null,
        lastMessagePreview: null,
        unreadCount: 0,
        createdAt: message.timestamp,
      })

      getPersistenceManager().storeChat({
        id: chatId,
        type,
        name: name ?? null,
        members,
        state: 'active',
        lastActivity: message.timestamp,
        lastMessageId: null,
        unreadCount: 0,
        createdAt: message.timestamp,
      }).catch(() => {})

      // Join signaling room for group chats
      if (type === 'group') {
        const sc = getSignalingClient()
        if (sc.getState() === 'connected') sc.joinRoom(chatId)
      }
    }
  }

  private handleChatInvite(message: NeonP2PMessage<'CHAT_INVITE'>, _peerId: string): void {
    const { chatId, chatName, members } = message.payload
    const chatStore = useChatStore.getState()
    const localId = usePeerStore.getState().localProfile?.id ?? ''

    if (!chatStore.chats.has(chatId)) {
      chatStore.upsertChat({
        id: chatId,
        type: 'group',
        name: chatName ?? null,
        members,
        state: 'active',
        lastActivity: message.timestamp,
        lastMessageId: null,
        lastMessagePreview: null,
        unreadCount: 0,
        createdAt: message.timestamp,
      })

      // Join signaling room for group discovery
      const sc = getSignalingClient()
      if (sc.getState() === 'connected') sc.joinRoom(chatId)

      // Send CHAT_JOIN back to all members
      const cm = getConnectionManager()
      for (const memberId of members) {
        if (memberId === localId) continue
        const joinMsg = createMessage('CHAT_JOIN', localId, memberId, {
          chatId,
          peerId: localId,
          displayName: usePeerStore.getState().localProfile?.displayName ?? '',
        }, chatId)
        cm.sendMessage(memberId, joinMsg)
      }
    }
  }

  private handleChatJoin(message: NeonP2PMessage<'CHAT_JOIN'>, _peerId: string): void {
    const { chatId, peerId, displayName } = message.payload
    const chatStore = useChatStore.getState()
    const chat = chatStore.chats.get(chatId)

    if (chat && !chat.members.includes(peerId)) {
      chatStore.upsertChat({
        ...chat,
        members: [...chat.members, peerId],
      })
    }

    // Update peer info
    usePeerStore.getState().upsertPeer({
      id: peerId,
      displayName,
      publicKey: '',
      capabilities: [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    })
  }

  private handleChatLeave(message: NeonP2PMessage<'CHAT_LEAVE'>, _peerId: string): void {
    const { chatId, peerId } = message.payload
    const chatStore = useChatStore.getState()
    const chat = chatStore.chats.get(chatId)

    if (chat) {
      chatStore.upsertChat({
        ...chat,
        members: chat.members.filter((m) => m !== peerId),
      })
    }

    // Leave signaling room if we're the one leaving
    const localId = usePeerStore.getState().localProfile?.id
    if (peerId === localId) {
      const sc = getSignalingClient()
      if (sc.getState() === 'connected') sc.leaveRoom(chatId)
    }
  }

  private handleChatSync(message: NeonP2PMessage<'CHAT_SYNC'>, peerId: string): void {
    const { chatId, direction } = message.payload

    if (direction === 'request') {
      // Send messages since lastMessageId
      const chatStore = useChatStore.getState()
      const messages = chatStore.messages.get(chatId) ?? []
      const localId = usePeerStore.getState().localProfile?.id ?? ''

      const syncMessages = messages.slice(-100).map((m) => ({
        id: m.id,
        from: m.from,
        content: m.content,
        timestamp: m.timestamp,
      }))

      const responseMsg = createMessage('CHAT_SYNC', localId, message.from, {
        chatId,
        direction: 'response',
        messages: syncMessages,
      }, chatId)
      getConnectionManager().sendMessage(peerId, responseMsg)
    } else if (direction === 'response' && message.payload.messages) {
      // Store synced messages
      const chatStore = useChatStore.getState()
      for (const msg of message.payload.messages) {
        const existing = (chatStore.messages.get(chatId) ?? []).find((m) => m.id === msg.id)
        if (!existing) {
          chatStore.addMessage({
            id: msg.id,
            chatId,
            from: msg.from,
            content: msg.content,
            timestamp: msg.timestamp,
            status: 'read',
          })
        }
      }
    }
  }

  private handleStatusUpdate(message: NeonP2PMessage<'STATUS_UPDATE'>, _peerId: string): void {
    usePeerStore.getState().setPeerStatus(message.from, Date.now(), message.payload.status)
  }
}

// Singleton
let routerInstance: MessageRouter | null = null

export function getMessageRouter(): MessageRouter {
  if (!routerInstance) {
    routerInstance = new MessageRouter()
  }
  return routerInstance
}
