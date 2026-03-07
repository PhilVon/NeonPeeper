import type { GifMeta } from './protocol'

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read'

export interface ChatMessage {
  id: string
  chatId: string
  from: string
  content: string
  timestamp: number
  status: MessageStatus
  replyTo?: string
  edited?: { editedAt: number; originalContent: string }
  deleted?: boolean
  contentType?: 'text' | 'gif'
  meta?: GifMeta
}

export type ChatType = 'direct' | 'group'
export type ChatState = 'created' | 'active' | 'archived' | 'left'

export interface Chat {
  id: string
  type: ChatType
  name: string | null
  members: string[]
  state: ChatState
  lastActivity: number
  lastMessageId: string | null
  lastMessagePreview: string | null
  unreadCount: number
  createdAt: number
}

export interface StoredMessage {
  id: string
  chatId: string
  from: string
  content: string
  timestamp: number
  status: MessageStatus
  receipts?: Record<string, 'delivered' | 'read'>
  replyTo?: string
  edited?: { editedAt: number; originalContent: string }
  deleted?: boolean
  contentType?: 'text' | 'gif'
  meta?: GifMeta
}

export interface StoredChat {
  id: string
  type: ChatType
  name: string | null
  members: string[]
  state: ChatState
  lastActivity: number
  lastMessageId: string | null
  unreadCount: number
  createdAt: number
}

export interface QueuedMessage {
  peerId: string
  message: ChatMessage
  attempts: number
  lastAttempt: number
}

export function generateDirectChatId(peerA: string, peerB: string): string {
  const sorted = [peerA, peerB].sort()
  return `direct:${sorted[0]}:${sorted[1]}`
}
