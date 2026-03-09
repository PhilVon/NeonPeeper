import { v4 as uuidv4 } from 'uuid'
import type { DatabaseAdapter } from './db/adapter'
import type { ConnectedClient, StoredMessage } from './types'
import type { ChannelManager } from './channel-manager'
import type { ModerationManager } from './moderation'
import type { CommunityConfig } from './config'
import type { MediaRelay } from './media-relay'

const PROTOCOL_VERSION = 'NEONP2P/1.0'
const HISTORY_DEFAULT_LIMIT = 50

interface Envelope {
  version: string
  type: string
  id: string
  from: string
  to: string
  chatId: string | null
  timestamp: number
  payload: Record<string, unknown>
}

export class MessageHandler {
  constructor(
    private db: DatabaseAdapter,
    private channelManager: ChannelManager,
    private moderation: ModerationManager,
    private config: CommunityConfig,
    private clients: Map<string, ConnectedClient>,
    private mediaRelay: MediaRelay
  ) {}

  async handle(client: ConnectedClient, msg: Envelope): Promise<void> {
    try {
      switch (msg.type) {
        case 'TEXT':
          await this.handleText(client, msg)
          break
        case 'TEXT_EDIT':
          await this.handleTextEdit(client, msg)
          break
        case 'TEXT_DELETE':
          await this.handleTextDelete(client, msg)
          break
        case 'TYPING_START':
        case 'TYPING_STOP':
          await this.handleTyping(client, msg)
          break
        case 'CHANNEL_LIST':
          await this.handleChannelList(client, msg)
          break
        case 'CHANNEL_JOIN':
          await this.handleChannelJoin(client, msg)
          break
        case 'CHANNEL_LEAVE':
          await this.handleChannelLeave(client, msg)
          break
        case 'CHANNEL_HISTORY':
          await this.handleChannelHistory(client, msg)
          break
        case 'CHANNEL_MEMBERS':
          await this.handleChannelMembers(client, msg)
          break
        case 'BAN_USER':
          await this.handleBanUser(client, msg)
          break
        case 'UNBAN_USER':
          await this.handleUnbanUser(client, msg)
          break
        case 'MEDIA_START':
          await this.handleMediaStart(client, msg)
          break
        case 'MEDIA_STOP':
          await this.handleMediaStop(client, msg)
          break
        case 'MEDIA_OFFER':
        case 'MEDIA_ANSWER':
        case 'MEDIA_ICE':
          this.handleMediaRelay(client, msg)
          break
        default:
          this.sendError(client, 2003, `Unknown message type: ${msg.type}`, msg.id)
      }
    } catch (err) {
      console.error(`[MessageHandler] Error handling ${msg.type}:`, err)
      this.sendError(client, 2000, 'Internal server error', msg.id)
    }
  }

  private async handleText(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as {
      content: string
      replyTo?: string
      contentType?: string
      meta?: Record<string, unknown>
      customEmojis?: unknown[]
    }
    const channelId = this.extractChannelId(msg.chatId)
    if (!channelId) {
      this.sendError(client, 7000, 'Invalid chatId', msg.id)
      return
    }

    if (!(await this.channelManager.isMember(channelId, client.peerId))) {
      this.sendError(client, 7002, 'Not a channel member', msg.id)
      return
    }

    if (!(await this.moderation.isAllowed(client.peerId, channelId))) {
      this.sendError(client, 7001, 'You are banned from this channel', msg.id)
      return
    }

    // Store message (strip TTL — ephemeral not supported in community)
    const stored: StoredMessage = {
      id: msg.id,
      channelId,
      fromPeerId: client.peerId,
      fromDisplayName: client.displayName,
      content: payload.content,
      contentType: payload.contentType || 'text',
      metaJson: payload.meta ? JSON.stringify(payload.meta) : undefined,
      customEmojisJson: payload.customEmojis ? JSON.stringify(payload.customEmojis) : undefined,
      replyTo: payload.replyTo,
      timestamp: msg.timestamp,
      deleted: false,
    }
    await this.db.storeMessage(stored)

    // Send TEXT_ACK back to sender
    this.sendToClient(client, {
      version: PROTOCOL_VERSION,
      type: 'TEXT_ACK',
      id: uuidv4(),
      from: this.config.serverId,
      to: client.peerId,
      chatId: msg.chatId,
      timestamp: Date.now(),
      payload: { messageId: msg.id, status: 'delivered' },
    })

    // Relay to all other members in the channel
    this.relayToChannel(channelId, msg, client.peerId)
  }

  private async handleTextEdit(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { messageId: string; content: string; editedAt: number }
    const channelId = this.extractChannelId(msg.chatId)
    if (!channelId) return

    if (!(await this.channelManager.isMember(channelId, client.peerId))) {
      this.sendError(client, 7002, 'Not a channel member', msg.id)
      return
    }

    // Get original message content for storing edit history
    const messages = await this.db.getMessages(channelId)
    const original = messages.find((m) => m.id === payload.messageId)
    if (original && original.fromPeerId === client.peerId) {
      await this.db.editMessage(payload.messageId, payload.content, payload.editedAt, original.content)
      this.relayToChannel(channelId, msg, client.peerId)
    }
  }

  private async handleTextDelete(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { messageId: string }
    const channelId = this.extractChannelId(msg.chatId)
    if (!channelId) return

    await this.db.deleteMessage(payload.messageId)
    this.relayToChannel(channelId, msg, client.peerId)
  }

  private async handleTyping(client: ConnectedClient, msg: Envelope): Promise<void> {
    const channelId = this.extractChannelId(msg.chatId)
    if (!channelId) return

    // Relay only, don't store
    this.relayToChannel(channelId, msg, client.peerId)
  }

  private async handleChannelList(client: ConnectedClient, msg: Envelope): Promise<void> {
    const channels = await this.channelManager.getChannels()
    const channelData = await Promise.all(
      channels.map(async (ch) => ({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        memberCount: await this.channelManager.getMemberCount(ch.id),
        topic: ch.topic,
      }))
    )

    this.sendToClient(client, {
      version: PROTOCOL_VERSION,
      type: 'CHANNEL_LIST',
      id: uuidv4(),
      from: this.config.serverId,
      to: client.peerId,
      chatId: null,
      timestamp: Date.now(),
      payload: { direction: 'response', channels: channelData },
    })
  }

  private async handleChannelJoin(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { channelId: string; peerId: string; displayName: string }
    const channelId = payload.channelId

    const channel = await this.channelManager.getChannel(channelId)
    if (!channel) {
      this.sendError(client, 7000, 'Channel not found', msg.id)
      return
    }

    if (!(await this.moderation.isAllowed(client.peerId, channelId))) {
      this.sendError(client, 7001, 'You are banned from this channel', msg.id)
      return
    }

    // Add to membership
    await this.channelManager.joinChannel(channelId, client.peerId, client.displayName)
    client.channels.add(channelId)

    // Notify existing channel members
    const chatId = `community:${this.config.serverId}:${channelId}`
    const joinMsg: Envelope = {
      version: PROTOCOL_VERSION,
      type: 'CHANNEL_JOIN',
      id: uuidv4(),
      from: this.config.serverId,
      to: '',
      chatId,
      timestamp: Date.now(),
      payload: { channelId, peerId: client.peerId, displayName: client.displayName },
    }
    this.relayToChannel(channelId, joinMsg, null) // include sender so they see the join too

    // Send recent history to the joining client
    const messages = await this.db.getMessages(channelId, undefined, HISTORY_DEFAULT_LIMIT)
    this.sendToClient(client, {
      version: PROTOCOL_VERSION,
      type: 'CHANNEL_HISTORY',
      id: uuidv4(),
      from: this.config.serverId,
      to: client.peerId,
      chatId,
      timestamp: Date.now(),
      payload: {
        channelId,
        direction: 'response',
        messages: messages.map(this.storedToHistoryMessage),
      },
    })
  }

  private async handleChannelLeave(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { channelId: string; peerId: string }
    const channelId = payload.channelId

    await this.channelManager.leaveChannel(channelId, client.peerId)
    client.channels.delete(channelId)

    // Notify remaining channel members
    const chatId = `community:${this.config.serverId}:${channelId}`
    const leaveMsg: Envelope = {
      version: PROTOCOL_VERSION,
      type: 'CHANNEL_LEAVE',
      id: uuidv4(),
      from: this.config.serverId,
      to: '',
      chatId,
      timestamp: Date.now(),
      payload: { channelId, peerId: client.peerId },
    }
    this.relayToChannel(channelId, leaveMsg, null)
  }

  private async handleChannelHistory(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { channelId: string; before?: number; limit?: number }
    const channelId = payload.channelId

    if (!(await this.channelManager.isMember(channelId, client.peerId))) {
      this.sendError(client, 7002, 'Not a channel member', msg.id)
      return
    }

    const messages = await this.db.getMessages(channelId, payload.before, payload.limit || HISTORY_DEFAULT_LIMIT)
    const chatId = `community:${this.config.serverId}:${channelId}`

    this.sendToClient(client, {
      version: PROTOCOL_VERSION,
      type: 'CHANNEL_HISTORY',
      id: uuidv4(),
      from: this.config.serverId,
      to: client.peerId,
      chatId,
      timestamp: Date.now(),
      payload: {
        channelId,
        direction: 'response',
        before: payload.before,
        limit: payload.limit,
        messages: messages.map(this.storedToHistoryMessage),
      },
    })
  }

  private async handleChannelMembers(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { channelId: string }
    const members = await this.channelManager.getMembers(payload.channelId)
    const chatId = `community:${this.config.serverId}:${payload.channelId}`

    this.sendToClient(client, {
      version: PROTOCOL_VERSION,
      type: 'CHANNEL_MEMBERS',
      id: uuidv4(),
      from: this.config.serverId,
      to: client.peerId,
      chatId,
      timestamp: Date.now(),
      payload: {
        channelId: payload.channelId,
        direction: 'response',
        members: members.map((m) => ({
          peerId: m.peerId,
          displayName: m.displayName,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    })
  }

  private async handleBanUser(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { channelId: string; targetPeerId: string; reason?: string }

    const success = await this.moderation.banUser(
      payload.channelId,
      payload.targetPeerId,
      client.peerId,
      payload.reason
    )
    if (!success) {
      this.sendError(client, 7003, 'Only the server owner can ban users', msg.id)
      return
    }

    // Notify the banned user
    const targetClient = this.clients.get(payload.targetPeerId)
    if (targetClient) {
      this.sendToClient(targetClient, {
        version: PROTOCOL_VERSION,
        type: 'BAN_USER',
        id: uuidv4(),
        from: this.config.serverId,
        to: payload.targetPeerId,
        chatId: null,
        timestamp: Date.now(),
        payload: {
          channelId: payload.channelId,
          targetPeerId: payload.targetPeerId,
          reason: payload.reason,
        },
      })

      // Remove from tracked channels
      if (payload.channelId === '*') {
        targetClient.channels.clear()
      } else {
        targetClient.channels.delete(payload.channelId)
      }
    }

    // Notify channel members about the ban
    if (payload.channelId === '*') {
      // Notify all channels
      for (const [, otherClient] of this.clients) {
        if (otherClient.peerId !== payload.targetPeerId) {
          this.sendToClient(otherClient, msg)
        }
      }
    } else {
      this.relayToChannel(payload.channelId, msg, payload.targetPeerId)
    }
  }

  private async handleUnbanUser(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { channelId: string; targetPeerId: string }

    const success = await this.moderation.unbanUser(payload.channelId, payload.targetPeerId, client.peerId)
    if (!success) {
      this.sendError(client, 7003, 'Only the server owner can unban users', msg.id)
      return
    }
  }

  // --- Media relay ---

  private async handleMediaStart(client: ConnectedClient, msg: Envelope): Promise<void> {
    const payload = msg.payload as { mediaType: string; trackId?: string }
    const channelId = this.extractChannelId(msg.chatId)
    if (!channelId) {
      this.sendError(client, 7000, 'Invalid chatId', msg.id)
      return
    }

    if (!(await this.channelManager.isMember(channelId, client.peerId))) {
      this.sendError(client, 7002, 'Not a channel member', msg.id)
      return
    }

    // Send existing participants to the joiner before adding them
    const existingParticipants = this.mediaRelay.getParticipants(channelId)
    const chatId = msg.chatId!
    for (const p of existingParticipants) {
      if (p.peerId === client.peerId) continue
      this.sendToClient(client, {
        version: PROTOCOL_VERSION,
        type: 'MEDIA_START',
        id: uuidv4(),
        from: p.peerId,
        to: client.peerId,
        chatId,
        timestamp: Date.now(),
        payload: { mediaType: p.mediaType, trackId: '' },
      })
    }

    // Add to session
    this.mediaRelay.joinSession(channelId, client.peerId, payload.mediaType)

    // Broadcast to channel (excluding the joiner)
    this.relayToChannel(channelId, msg, client.peerId)
  }

  private async handleMediaStop(client: ConnectedClient, msg: Envelope): Promise<void> {
    const channelId = this.extractChannelId(msg.chatId)
    if (!channelId) return

    this.mediaRelay.leaveSession(channelId, client.peerId)
    this.relayToChannel(channelId, msg, client.peerId)
  }

  private handleMediaRelay(_client: ConnectedClient, msg: Envelope): void {
    // Point-to-point relay: forward to the target peer
    const targetPeerId = msg.to
    if (!targetPeerId) return

    const targetClient = this.clients.get(targetPeerId)
    if (targetClient) {
      this.sendToClient(targetClient, msg)
    }
  }

  // --- Helpers ---

  private extractChannelId(chatId: string | null): string | null {
    if (!chatId) return null
    // chatId format: "community:serverId:channelId"
    const parts = chatId.split(':')
    if (parts.length === 3 && parts[0] === 'community') {
      return parts[2]
    }
    return null
  }

  private relayToChannel(channelId: string, msg: Envelope, excludePeerId: string | null): void {
    for (const [, otherClient] of this.clients) {
      if (excludePeerId && otherClient.peerId === excludePeerId) continue
      if (otherClient.channels.has(channelId)) {
        this.sendToClient(otherClient, msg)
      }
    }
  }

  private sendToClient(client: ConnectedClient, msg: Envelope): void {
    if (client.ws.readyState === 1 /* OPEN */) {
      client.ws.send(JSON.stringify(msg))
    }
  }

  private sendError(client: ConnectedClient, code: number, message: string, relatedMessageId?: string): void {
    this.sendToClient(client, {
      version: PROTOCOL_VERSION,
      type: 'ERROR',
      id: uuidv4(),
      from: this.config.serverId,
      to: client.peerId,
      chatId: null,
      timestamp: Date.now(),
      payload: { code, message, relatedMessageId },
    })
  }

  private storedToHistoryMessage(m: StoredMessage) {
    return {
      id: m.id,
      from: m.fromPeerId,
      displayName: m.fromDisplayName,
      content: m.content,
      timestamp: m.timestamp,
      contentType: m.contentType === 'text' ? undefined : m.contentType,
      meta: m.metaJson ? JSON.parse(m.metaJson) : undefined,
      customEmojis: m.customEmojisJson ? JSON.parse(m.customEmojisJson) : undefined,
      replyTo: m.replyTo,
      edited: m.editedAt ? { editedAt: m.editedAt, originalContent: m.originalContent || '' } : undefined,
      deleted: m.deleted || undefined,
    }
  }
}
