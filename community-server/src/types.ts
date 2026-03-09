export interface Channel {
  id: string
  name: string
  description: string
  topic?: string
  createdAt: number
  updatedAt: number
}

export interface StoredMessage {
  id: string
  channelId: string
  fromPeerId: string
  fromDisplayName: string
  content: string
  contentType: string
  metaJson?: string
  customEmojisJson?: string
  replyTo?: string
  timestamp: number
  editedAt?: number
  originalContent?: string
  deleted: boolean
}

export interface ChannelMember {
  channelId: string
  peerId: string
  displayName: string
  role: 'owner' | 'member'
  joinedAt: number
}

export interface Ban {
  peerId: string
  channelId: string // '*' for server-wide
  reason?: string
  bannedAt: number
  bannedBy: string
}

export interface ConnectedClient {
  ws: import('ws').WebSocket
  peerId: string
  displayName: string
  channels: Set<string>
}
