import { v4 as uuidv4 } from 'uuid'
import { usePeerStore } from '../store/peer-store'
import { useChatStore } from '../store/chat-store'
import { useCommunityStore } from '../store/community-store'
import type { CommunityChannel, CommunityChannelMember } from '../store/community-store'
import { toast } from '../store/toast-store'
import { generateCommunityChatId } from '../types/chat'
import { useMediaStore } from '../store/media-store'
import { useSettingsStore } from '../store/settings-store'
import { getMediaManager } from './MediaManager'
import type {
  NeonP2PMessage,
  CommunityInfoPayload,
  ChannelListPayload,
  ChannelJoinPayload,
  ChannelLeavePayload,
  ChannelHistoryPayload,
  ChannelMembersPayload,
  BanUserPayload,
  TextPayload,
  TextEditPayload,
  TextDeletePayload,
  MediaOfferPayload,
  MediaAnswerPayload,
  MediaIcePayload,
} from '../types/protocol'

const PROTOCOL_VERSION = 'NEONP2P/1.0'

interface ServerConnection {
  ws: WebSocket
  serverId: string
  wsUrl: string
  reconnectTimer: ReturnType<typeof setTimeout> | null
  reconnectAttempts: number
}

export class CommunityClient {
  private connections = new Map<string, ServerConnection>()
  private maxReconnectAttempts = 10
  // channelChatId:remotePeerId → RTCPeerConnection (media-only, no data channels)
  private mediaPeerConnections = new Map<string, RTCPeerConnection>()

  connect(serverId: string, wsUrl: string): void {
    // Don't double-connect
    if (this.connections.has(serverId)) {
      const existing = this.connections.get(serverId)!
      if (existing.ws.readyState === WebSocket.OPEN || existing.ws.readyState === WebSocket.CONNECTING) {
        return
      }
    }

    const ws = new WebSocket(wsUrl)
    const conn: ServerConnection = {
      ws,
      serverId,
      wsUrl,
      reconnectTimer: null,
      reconnectAttempts: 0,
    }
    this.connections.set(serverId, conn)

    ws.onopen = () => {
      conn.reconnectAttempts = 0
      // Send HELLO handshake
      const profile = usePeerStore.getState().localProfile
      if (profile) {
        this.sendRaw(serverId, {
          version: PROTOCOL_VERSION,
          type: 'HELLO',
          id: uuidv4(),
          from: profile.id,
          to: serverId,
          chatId: null,
          timestamp: Date.now(),
          payload: {
            displayName: profile.displayName,
            publicKey: profile.publicKey,
            capabilities: profile.capabilities,
            avatarDataUrl: profile.avatarDataUrl,
          },
        })
      }
    }

    ws.onmessage = (event) => {
      let msg: NeonP2PMessage
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }
      this.handleMessage(serverId, msg)
    }

    ws.onclose = () => {
      useCommunityStore.getState().setServerConnected(serverId, false)
      this.scheduleReconnect(serverId)
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  }

  disconnect(serverId: string): void {
    const conn = this.connections.get(serverId)
    if (!conn) return

    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
    }

    // Close all media peer connections for this server
    const prefix = `community:${serverId}:`
    for (const [key, pc] of this.mediaPeerConnections) {
      if (key.startsWith(prefix)) {
        pc.close()
        this.mediaPeerConnections.delete(key)
      }
    }

    conn.ws.close()
    this.connections.delete(serverId)
    useCommunityStore.getState().setServerConnected(serverId, false)
  }

  disconnectAll(): void {
    for (const serverId of [...this.connections.keys()]) {
      this.disconnect(serverId)
    }
  }

  requestChannelList(serverId: string): void {
    this.sendMessage(serverId, 'CHANNEL_LIST', { direction: 'request' }, null)
  }

  joinChannel(serverId: string, channelId: string): void {
    const profile = usePeerStore.getState().localProfile
    if (!profile) return

    this.sendMessage(
      serverId,
      'CHANNEL_JOIN',
      { channelId, peerId: profile.id, displayName: profile.displayName },
      null
    )

    // Optimistically create the community chat so UI can switch immediately
    const chatId = generateCommunityChatId(serverId, channelId)
    const serverInfo = useCommunityStore.getState().servers.get(serverId)
    const channels = useCommunityStore.getState().channels.get(serverId) || []
    const channel = channels.find((c) => c.id === channelId)
    const chatName = `${serverInfo?.serverName || serverId} > #${channel?.name || channelId}`

    useCommunityStore.getState().updateChannelJoined(serverId, channelId, true)
    useChatStore.getState().upsertChat({
      id: chatId,
      type: 'community',
      name: chatName,
      members: [profile.id],
      state: 'active',
      lastActivity: Date.now(),
      lastMessageId: null,
      lastMessagePreview: null,
      unreadCount: 0,
      createdAt: Date.now(),
    })
  }

  leaveChannel(serverId: string, channelId: string): void {
    const profile = usePeerStore.getState().localProfile
    if (!profile) return

    const chatId = generateCommunityChatId(serverId, channelId)
    this.sendMessage(serverId, 'CHANNEL_LEAVE', { channelId, peerId: profile.id }, chatId)

    // Update local state
    useCommunityStore.getState().updateChannelJoined(serverId, channelId, false)
    const chat = useChatStore.getState().chats.get(chatId)
    if (chat) {
      useChatStore.getState().upsertChat({ ...chat, state: 'archived' })
    }
  }

  sendTextMessage(
    serverId: string,
    channelId: string,
    content: string,
    options?: { replyTo?: string; contentType?: 'text' | 'gif'; meta?: Record<string, unknown>; customEmojis?: unknown[] }
  ): string {
    const chatId = generateCommunityChatId(serverId, channelId)
    const msgId = uuidv4()
    const profile = usePeerStore.getState().localProfile
    if (!profile) return msgId

    const payload: Record<string, unknown> = {
      content,
      contentType: options?.contentType || 'text',
    }
    if (options?.replyTo) payload.replyTo = options.replyTo
    if (options?.meta) payload.meta = options.meta
    if (options?.customEmojis) payload.customEmojis = options.customEmojis

    const msg = {
      version: PROTOCOL_VERSION,
      type: 'TEXT',
      id: msgId,
      from: profile.id,
      to: serverId,
      chatId,
      timestamp: Date.now(),
      payload,
    }

    this.sendRaw(serverId, msg)

    // Add to local chat store immediately (optimistic)
    useChatStore.getState().addMessage({
      id: msgId,
      chatId,
      from: profile.id,
      content,
      timestamp: msg.timestamp,
      status: 'sending',
      replyTo: options?.replyTo,
      contentType: options?.contentType || 'text',
      meta: options?.meta as import('../types/protocol').GifMeta | undefined,
      customEmojis: options?.customEmojis as import('../types/emoji').EmbeddedEmoji[] | undefined,
    })

    return msgId
  }

  sendEdit(serverId: string, channelId: string, messageId: string, content: string): void {
    const chatId = generateCommunityChatId(serverId, channelId)
    this.sendMessage(serverId, 'TEXT_EDIT', { messageId, content, editedAt: Date.now() }, chatId)
  }

  sendDelete(serverId: string, channelId: string, messageId: string): void {
    const chatId = generateCommunityChatId(serverId, channelId)
    this.sendMessage(serverId, 'TEXT_DELETE', { messageId }, chatId)
  }

  sendTypingStart(serverId: string, channelId: string): void {
    const chatId = generateCommunityChatId(serverId, channelId)
    this.sendMessage(serverId, 'TYPING_START', {}, chatId)
  }

  sendTypingStop(serverId: string, channelId: string): void {
    const chatId = generateCommunityChatId(serverId, channelId)
    this.sendMessage(serverId, 'TYPING_STOP', {}, chatId)
  }

  requestHistory(serverId: string, channelId: string, before?: number): void {
    const chatId = generateCommunityChatId(serverId, channelId)
    this.sendMessage(serverId, 'CHANNEL_HISTORY', { channelId, direction: 'request', before, limit: 50 }, chatId)
  }

  requestMembers(serverId: string, channelId: string): void {
    const chatId = generateCommunityChatId(serverId, channelId)
    this.sendMessage(serverId, 'CHANNEL_MEMBERS', { channelId, direction: 'request' }, chatId)
  }

  banUser(serverId: string, channelId: string, targetPeerId: string, reason?: string): void {
    this.sendMessage(serverId, 'BAN_USER', { channelId, targetPeerId, reason }, null)
  }

  unbanUser(serverId: string, channelId: string, targetPeerId: string): void {
    this.sendMessage(serverId, 'UNBAN_USER', { channelId, targetPeerId }, null)
  }

  // --- Media methods ---

  async startCommunityVoice(serverId: string, channelId: string, withVideo: boolean): Promise<void> {
    const mm = getMediaManager()
    const chatId = generateCommunityChatId(serverId, channelId)
    const localId = usePeerStore.getState().localProfile?.id
    if (!localId) return

    try {
      if (withVideo) {
        await mm.startCamera()
        useMediaStore.getState().setVideoEnabled(true)
      } else {
        await mm.startMicOnly()
        useMediaStore.getState().setVideoEnabled(false)
      }

      useMediaStore.getState().startSharingInChat(chatId)
      useMediaStore.getState().addChatVideoParticipant(chatId, localId)

      // Notify the server
      this.sendMessage(serverId, 'MEDIA_START', {
        mediaType: withVideo ? 'camera' : 'audio',
        trackId: '',
      }, chatId)
    } catch (err) {
      console.error('[CommunityClient] Failed to start voice:', err)
      toast.error('Failed to start media. Check permissions.')
      mm.stopCamera()
    }
  }

  stopCommunityVoice(serverId: string, channelId: string): void {
    const chatId = generateCommunityChatId(serverId, channelId)
    const localId = usePeerStore.getState().localProfile?.id
    if (!localId) return

    // Close all media peer connections for this channel
    for (const [key, pc] of this.mediaPeerConnections) {
      if (key.startsWith(chatId + ':')) {
        pc.close()
        this.mediaPeerConnections.delete(key)
        const remotePeerId = key.slice(chatId.length + 1)
        useMediaStore.getState().removeRemoteStream(remotePeerId)
        useMediaStore.getState().removeChatVideoParticipant(chatId, remotePeerId)
      }
    }

    useMediaStore.getState().stopSharingInChat(chatId)
    useMediaStore.getState().removeChatVideoParticipant(chatId, localId)

    // Only stop camera if not sharing in any other chat
    const remaining = useMediaStore.getState().videoSharingChatIds
    if (remaining.size === 0) {
      getMediaManager().stopCamera()
    }

    this.sendMessage(serverId, 'MEDIA_STOP', {
      mediaType: 'camera',
      trackId: '',
    }, chatId)
  }

  private getIceServers(): RTCIceServer[] {
    const settings = useSettingsStore.getState()
    const servers: RTCIceServer[] = settings.stunServers.map((url) => ({ urls: url }))
    if (settings.turnServer) {
      servers.push({
        urls: settings.turnServer,
        username: settings.turnUsername,
        credential: settings.turnPassword,
      })
    }
    return servers
  }

  private createMediaPeerConnection(chatId: string, remotePeerId: string, serverId: string): RTCPeerConnection {
    const key = `${chatId}:${remotePeerId}`
    const existing = this.mediaPeerConnections.get(key)
    if (existing) {
      existing.close()
    }

    const pc = new RTCPeerConnection({
      iceServers: this.getIceServers(),
    })

    this.mediaPeerConnections.set(key, pc)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendRaw(serverId, {
          version: PROTOCOL_VERSION,
          type: 'MEDIA_ICE',
          id: uuidv4(),
          from: usePeerStore.getState().localProfile?.id || '',
          to: remotePeerId,
          chatId,
          timestamp: Date.now(),
          payload: { candidate: event.candidate.toJSON() },
        })
      }
    }

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        useMediaStore.getState().addRemoteStream(remotePeerId, event.streams[0])
        useMediaStore.getState().addChatVideoParticipant(chatId, remotePeerId)
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        pc.close()
        this.mediaPeerConnections.delete(key)
        useMediaStore.getState().removeRemoteStream(remotePeerId)
        useMediaStore.getState().removeChatVideoParticipant(chatId, remotePeerId)
      }
    }

    return pc
  }

  private async initiateMediaConnection(chatId: string, remotePeerId: string, serverId: string): Promise<void> {
    const pc = this.createMediaPeerConnection(chatId, remotePeerId, serverId)
    const localStream = useMediaStore.getState().localCameraStream
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream)
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    this.sendRaw(serverId, {
      version: PROTOCOL_VERSION,
      type: 'MEDIA_OFFER',
      id: uuidv4(),
      from: usePeerStore.getState().localProfile?.id || '',
      to: remotePeerId,
      chatId,
      timestamp: Date.now(),
      payload: {
        sdp: offer.sdp!,
        mediaType: useMediaStore.getState().videoEnabled ? 'camera' : 'audio',
      },
    })
  }

  isConnected(serverId: string): boolean {
    const conn = this.connections.get(serverId)
    return conn?.ws.readyState === WebSocket.OPEN
  }

  // --- Internal ---

  private handleMessage(serverId: string, msg: NeonP2PMessage): void {
    switch (msg.type) {
      case 'COMMUNITY_INFO':
        this.handleCommunityInfo(serverId, msg.payload as CommunityInfoPayload)
        break
      case 'CHANNEL_LIST':
        this.handleChannelList(serverId, msg.payload as ChannelListPayload)
        break
      case 'CHANNEL_JOIN':
        this.handleChannelJoin(serverId, msg)
        break
      case 'CHANNEL_LEAVE':
        this.handleChannelLeave(serverId, msg)
        break
      case 'CHANNEL_HISTORY':
        this.handleChannelHistory(serverId, msg.payload as ChannelHistoryPayload)
        break
      case 'CHANNEL_MEMBERS':
        this.handleChannelMembers(serverId, msg)
        break
      case 'TEXT':
        this.handleText(serverId, msg)
        break
      case 'TEXT_ACK':
        this.handleTextAck(msg)
        break
      case 'TEXT_EDIT':
        this.handleTextEdit(msg)
        break
      case 'TEXT_DELETE':
        this.handleTextDelete(msg)
        break
      case 'TYPING_START':
      case 'TYPING_STOP':
        this.handleTyping(msg)
        break
      case 'BAN_USER':
        this.handleBan(serverId, msg.payload as BanUserPayload)
        break
      case 'MEDIA_START':
        this.handleMediaStart(serverId, msg)
        break
      case 'MEDIA_STOP':
        this.handleMediaStop(serverId, msg)
        break
      case 'MEDIA_OFFER':
        this.handleMediaOffer(serverId, msg)
        break
      case 'MEDIA_ANSWER':
        this.handleMediaAnswer(msg)
        break
      case 'MEDIA_ICE':
        this.handleMediaIce(msg)
        break
      case 'ERROR':
        this.handleError(msg)
        break
    }
  }

  private handleCommunityInfo(_serverId: string, payload: CommunityInfoPayload): void {
    useCommunityStore.getState().upsertServer({
      serverId: payload.serverId,
      serverName: payload.serverName,
      description: payload.description,
      iconDataUrl: payload.iconDataUrl,
      channelCount: payload.channelCount,
      memberCount: payload.memberCount,
      ownerId: payload.ownerId,
      connected: true,
    })
  }

  private handleChannelList(serverId: string, payload: ChannelListPayload): void {
    if (payload.direction !== 'response' || !payload.channels) return

    // Preserve joined state from existing channels
    const existingChannels = useCommunityStore.getState().channels.get(serverId) || []
    const joinedSet = new Set(existingChannels.filter((c) => c.joined).map((c) => c.id))

    const channels: CommunityChannel[] = payload.channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      description: ch.description,
      memberCount: ch.memberCount,
      topic: ch.topic,
      joined: joinedSet.has(ch.id),
    }))
    useCommunityStore.getState().setChannels(serverId, channels)
  }

  private handleChannelJoin(serverId: string, msg: NeonP2PMessage): void {
    const payload = msg.payload as ChannelJoinPayload
    const profile = usePeerStore.getState().localProfile
    const chatId = generateCommunityChatId(serverId, payload.channelId)

    if (profile && payload.peerId === profile.id) {
      // We joined — create community chat
      useCommunityStore.getState().updateChannelJoined(serverId, payload.channelId, true)

      const serverInfo = useCommunityStore.getState().servers.get(serverId)
      const channels = useCommunityStore.getState().channels.get(serverId) || []
      const channel = channels.find((c) => c.id === payload.channelId)
      const chatName = `${serverInfo?.serverName || serverId} > #${channel?.name || payload.channelId}`

      useChatStore.getState().upsertChat({
        id: chatId,
        type: 'community',
        name: chatName,
        members: [profile.id],
        state: 'active',
        lastActivity: Date.now(),
        lastMessageId: null,
        lastMessagePreview: null,
        unreadCount: 0,
        createdAt: Date.now(),
      })
    } else {
      // Someone else joined — add system-like notification
      useChatStore.getState().addMessage({
        id: uuidv4(),
        chatId,
        from: 'system',
        content: `${payload.displayName} joined the channel`,
        timestamp: msg.timestamp,
        status: 'delivered',
      })
    }
  }

  private handleChannelLeave(serverId: string, msg: NeonP2PMessage): void {
    const payload = msg.payload as ChannelLeavePayload
    const chatId = generateCommunityChatId(serverId, payload.channelId)
    const profile = usePeerStore.getState().localProfile

    if (profile && payload.peerId !== profile.id) {
      useChatStore.getState().addMessage({
        id: uuidv4(),
        chatId,
        from: 'system',
        content: `${payload.peerId} left the channel`,
        timestamp: msg.timestamp,
        status: 'delivered',
      })
    }
  }

  private handleChannelHistory(serverId: string, payload: ChannelHistoryPayload): void {
    if (payload.direction !== 'response' || !payload.messages) return

    const chatId = generateCommunityChatId(serverId, payload.channelId)

    for (const m of payload.messages) {
      useChatStore.getState().addMessage({
        id: m.id,
        chatId,
        from: m.from,
        content: m.content,
        timestamp: m.timestamp,
        status: 'delivered',
        contentType: m.contentType || 'text',
        meta: m.meta,
        replyTo: m.replyTo,
        edited: m.edited,
        deleted: m.deleted,
        customEmojis: m.customEmojis,
      })
    }
  }

  private handleChannelMembers(serverId: string, msg: NeonP2PMessage): void {
    const payload = msg.payload as ChannelMembersPayload
    if (payload.direction !== 'response' || !payload.members) return

    const chatId = msg.chatId || generateCommunityChatId(serverId, payload.channelId)
    const members: CommunityChannelMember[] = payload.members.map((m) => ({
      peerId: m.peerId,
      displayName: m.displayName,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
    useCommunityStore.getState().setMembers(chatId, members)
  }

  private handleText(_serverId: string, msg: NeonP2PMessage): void {
    const payload = msg.payload as TextPayload
    const chatId = msg.chatId
    if (!chatId) return

    useChatStore.getState().addMessage({
      id: msg.id,
      chatId,
      from: msg.from,
      content: payload.content,
      timestamp: msg.timestamp,
      status: 'delivered',
      replyTo: payload.replyTo,
      contentType: payload.contentType || 'text',
      meta: payload.meta,
      customEmojis: payload.customEmojis,
    })
  }

  private handleTextAck(msg: NeonP2PMessage): void {
    const payload = msg.payload as { messageId: string; status: string }
    if (payload.status === 'delivered' && msg.chatId) {
      useChatStore.getState().updateMessageStatus(payload.messageId, msg.chatId, 'delivered')
    }
  }

  private handleTextEdit(msg: NeonP2PMessage): void {
    const payload = msg.payload as TextEditPayload
    const chatId = msg.chatId
    if (!chatId) return

    useChatStore.getState().editMessage(payload.messageId, chatId, payload.content, payload.editedAt)
  }

  private handleTextDelete(msg: NeonP2PMessage): void {
    const payload = msg.payload as TextDeletePayload
    const chatId = msg.chatId
    if (!chatId) return

    useChatStore.getState().deleteMessage(payload.messageId, chatId)
  }

  private handleTyping(msg: NeonP2PMessage): void {
    const chatId = msg.chatId
    if (!chatId) return

    if (msg.type === 'TYPING_START') {
      useChatStore.getState().setTyping(chatId, msg.from, true)
    } else {
      useChatStore.getState().setTyping(chatId, msg.from, false)
    }
  }

  private handleBan(serverId: string, payload: BanUserPayload): void {
    const profile = usePeerStore.getState().localProfile
    if (!profile || payload.targetPeerId !== profile.id) return

    if (payload.channelId === '*') {
      toast.error(`You have been banned from the community server`)
      // Archive all community chats for this server
      const chats = useChatStore.getState().chats
      for (const [chatId, chat] of chats) {
        if (chatId.startsWith(`community:${serverId}:`)) {
          useChatStore.getState().upsertChat({ ...chat, state: 'archived' })
        }
      }
      this.disconnect(serverId)
    } else {
      const channels = useCommunityStore.getState().channels.get(serverId) || []
      const channel = channels.find((c) => c.id === payload.channelId)
      const channelName = channel?.name || payload.channelId
      toast.error(`You have been banned from #${channelName}`)

      const chatId = generateCommunityChatId(serverId, payload.channelId)
      const chat = useChatStore.getState().chats.get(chatId)
      if (chat) {
        useChatStore.getState().upsertChat({ ...chat, state: 'archived' })
      }
      useCommunityStore.getState().updateChannelJoined(serverId, payload.channelId, false)
    }
  }

  private handleMediaStart(serverId: string, msg: NeonP2PMessage): void {
    const chatId = msg.chatId
    if (!chatId) return

    const localId = usePeerStore.getState().localProfile?.id
    if (!localId || msg.from === localId) return

    // Add remote participant to the media store
    useMediaStore.getState().addChatVideoParticipant(chatId, msg.from)

    // If we're in voice too, initiate WebRTC (tie-break: lower ID initiates)
    const isLocalSharing = useMediaStore.getState().videoSharingChatIds.has(chatId)
    if (isLocalSharing && localId < msg.from) {
      this.initiateMediaConnection(chatId, msg.from, serverId).catch((err) => {
        console.error('[CommunityClient] Failed to initiate media connection:', err)
      })
    }
  }

  private handleMediaStop(_serverId: string, msg: NeonP2PMessage): void {
    const chatId = msg.chatId
    if (!chatId) return

    const key = `${chatId}:${msg.from}`
    const pc = this.mediaPeerConnections.get(key)
    if (pc) {
      pc.close()
      this.mediaPeerConnections.delete(key)
    }

    useMediaStore.getState().removeRemoteStream(msg.from)
    useMediaStore.getState().removeChatVideoParticipant(chatId, msg.from)
  }

  private async handleMediaOffer(serverId: string, msg: NeonP2PMessage): Promise<void> {
    const payload = msg.payload as MediaOfferPayload
    const chatId = msg.chatId
    if (!chatId) return

    const localId = usePeerStore.getState().localProfile?.id
    if (!localId) return

    const pc = this.createMediaPeerConnection(chatId, msg.from, serverId)

    // Add local tracks
    const localStream = useMediaStore.getState().localCameraStream
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream)
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    this.sendRaw(serverId, {
      version: PROTOCOL_VERSION,
      type: 'MEDIA_ANSWER',
      id: uuidv4(),
      from: localId,
      to: msg.from,
      chatId,
      timestamp: Date.now(),
      payload: { sdp: answer.sdp! },
    })
  }

  private async handleMediaAnswer(msg: NeonP2PMessage): Promise<void> {
    const payload = msg.payload as MediaAnswerPayload
    const chatId = msg.chatId
    if (!chatId) return

    const key = `${chatId}:${msg.from}`
    const pc = this.mediaPeerConnections.get(key)
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }))
    }
  }

  private async handleMediaIce(msg: NeonP2PMessage): Promise<void> {
    const payload = msg.payload as MediaIcePayload
    const chatId = msg.chatId
    if (!chatId) return

    const key = `${chatId}:${msg.from}`
    const pc = this.mediaPeerConnections.get(key)
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
    }
  }

  private handleError(msg: NeonP2PMessage): void {
    const payload = msg.payload as { code: number; message: string }
    console.error(`[CommunityClient] Error ${payload.code}: ${payload.message}`)
    toast.error(`Community: ${payload.message}`)
  }

  private sendMessage(serverId: string, type: string, payload: Record<string, unknown>, chatId: string | null): void {
    const profile = usePeerStore.getState().localProfile
    if (!profile) return

    this.sendRaw(serverId, {
      version: PROTOCOL_VERSION,
      type,
      id: uuidv4(),
      from: profile.id,
      to: serverId,
      chatId,
      timestamp: Date.now(),
      payload,
    })
  }

  private sendRaw(serverId: string, msg: Record<string, unknown>): void {
    const conn = this.connections.get(serverId)
    if (conn?.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect(serverId: string): void {
    const conn = this.connections.get(serverId)
    if (!conn || conn.reconnectAttempts >= this.maxReconnectAttempts) return

    const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts), 30000)
    conn.reconnectAttempts++

    conn.reconnectTimer = setTimeout(() => {
      if (this.connections.has(serverId)) {
        this.connect(serverId, conn.wsUrl)
      }
    }, delay)
  }
}

// Singleton
let instance: CommunityClient | null = null

export function getCommunityClient(): CommunityClient {
  if (!instance) {
    instance = new CommunityClient()
  }
  return instance
}
