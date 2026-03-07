// Protocol version constant
export const PROTOCOL_VERSION = 'NEONP2P/1.0' as const

// All 24 message types
export type MessageType =
  // Connection (5)
  | 'HELLO'
  | 'HELLO_ACK'
  | 'PING'
  | 'PONG'
  | 'DISCONNECT'
  // Text (4)
  | 'TEXT'
  | 'TEXT_ACK'
  | 'TEXT_EDIT'
  | 'TEXT_DELETE'
  // Presence (3)
  | 'TYPING_START'
  | 'TYPING_STOP'
  | 'STATUS_UPDATE'
  // Chat session (5)
  | 'CHAT_CREATE'
  | 'CHAT_INVITE'
  | 'CHAT_JOIN'
  | 'CHAT_LEAVE'
  | 'CHAT_SYNC'
  // Media (6)
  | 'MEDIA_OFFER'
  | 'MEDIA_ANSWER'
  | 'MEDIA_ICE'
  | 'MEDIA_START'
  | 'MEDIA_STOP'
  | 'MEDIA_QUALITY'
  // Error (1)
  | 'ERROR'

// --- Payload interfaces ---

// Connection payloads
export interface HelloPayload {
  displayName: string
  publicKey: string
  capabilities: string[]
}

export interface HelloAckPayload {
  displayName: string
  publicKey: string
  capabilities: string[]
  ackedPeerId: string
}

export interface PingPayload {
  seq: number
}

export interface PongPayload {
  seq: number
}

export type DisconnectCode = 'USER_INITIATED' | 'APP_CLOSING' | 'PROTOCOL_ERROR' | 'TIMEOUT'

export interface DisconnectPayload {
  reason: string
  code: DisconnectCode
}

// GIF metadata
export interface GifMeta {
  gifUrl: string
  gifPreviewUrl: string
  gifWidth: number
  gifHeight: number
  gifTitle: string
}

// Text payloads
export interface TextPayload {
  content: string
  replyTo?: string
  contentType?: 'text' | 'gif'
  meta?: GifMeta
}

export interface TextAckPayload {
  messageId: string
  status: 'delivered' | 'read'
}

export interface TextEditPayload {
  messageId: string
  content: string
  editedAt: number
}

export interface TextDeletePayload {
  messageId: string
}

// Presence payloads
export interface TypingPayload {}

export interface StatusUpdatePayload {
  status: 'online' | 'busy' | 'idle'
}

// Chat session payloads
export interface ChatCreatePayload {
  chatId: string
  type: 'direct' | 'group'
  name?: string
  members: string[]
}

export interface ChatInvitePayload {
  chatId: string
  invitedPeerId: string
  chatName?: string
  members: string[]
}

export interface ChatJoinPayload {
  chatId: string
  peerId: string
  displayName: string
}

export interface ChatLeavePayload {
  chatId: string
  peerId: string
}

export interface ChatSyncPayload {
  chatId: string
  direction: 'request' | 'response'
  lastMessageId?: string
  messages?: Array<{
    id: string
    from: string
    content: string
    timestamp: number
  }>
}

// Media payloads
export type MediaType = 'camera' | 'screen' | 'camera+screen' | 'audio'
export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'adaptive'

export interface MediaOfferPayload {
  sdp: string
  mediaType: MediaType
}

export interface MediaAnswerPayload {
  sdp: string
}

export interface MediaIcePayload {
  candidate: RTCIceCandidateInit
}

export interface MediaStartPayload {
  mediaType: MediaType
  trackId: string
  quality?: QualityPreset
}

export interface MediaStopPayload {
  mediaType: MediaType
  trackId: string
}

export interface MediaQualityPayload {
  direction: 'request' | 'notify'
  quality: QualityPreset
  constraints?: {
    maxBitrate?: number
    maxFramerate?: number
    maxWidth?: number
    maxHeight?: number
  }
}

// Error payload
export interface ErrorPayload {
  code: number
  message: string
  relatedMessageId?: string
}

// --- Payload type map (discriminated union support) ---

export interface PayloadMap {
  HELLO: HelloPayload
  HELLO_ACK: HelloAckPayload
  PING: PingPayload
  PONG: PongPayload
  DISCONNECT: DisconnectPayload
  TEXT: TextPayload
  TEXT_ACK: TextAckPayload
  TEXT_EDIT: TextEditPayload
  TEXT_DELETE: TextDeletePayload
  TYPING_START: TypingPayload
  TYPING_STOP: TypingPayload
  STATUS_UPDATE: StatusUpdatePayload
  CHAT_CREATE: ChatCreatePayload
  CHAT_INVITE: ChatInvitePayload
  CHAT_JOIN: ChatJoinPayload
  CHAT_LEAVE: ChatLeavePayload
  CHAT_SYNC: ChatSyncPayload
  MEDIA_OFFER: MediaOfferPayload
  MEDIA_ANSWER: MediaAnswerPayload
  MEDIA_ICE: MediaIcePayload
  MEDIA_START: MediaStartPayload
  MEDIA_STOP: MediaStopPayload
  MEDIA_QUALITY: MediaQualityPayload
  ERROR: ErrorPayload
}

// --- Protocol message envelope ---

export interface NeonP2PMessage<T extends MessageType = MessageType> {
  version: typeof PROTOCOL_VERSION
  type: T
  id: string
  from: string
  to: string
  chatId: string | null
  timestamp: number
  payload: PayloadMap[T]
  signature?: string
}

// Discriminated union of all concrete message types
export type AnyNeonP2PMessage = {
  [T in MessageType]: NeonP2PMessage<T>
}[MessageType]

// --- Protocol constants ---

export const PROTOCOL_CONSTANTS = {
  PING_INTERVAL_MS: 15_000,
  PONG_TIMEOUT_MS: 5_000,
  MAX_MISSED_PONGS: 3,
  MAX_TEXT_LENGTH: 16_384,
  MAX_MESSAGE_SIZE: 65_536,
  FILE_CHUNK_SIZE: 16_384,
  TYPING_DEBOUNCE_MS: 3_000,
  TYPING_EXPIRE_MS: 5_000,
  CHAT_SYNC_LIMIT: 100,
  DEDUP_HISTORY_SIZE: 10_000,
  DEDUP_PRUNE_SIZE: 5_000,
} as const

// Error code ranges
export const ERROR_CODES = {
  // Connection errors (1000-1099)
  CONNECTION_GENERIC: 1000,
  UNSUPPORTED_VERSION: 1001,
  INVALID_PEER_ID: 1002,
  CONNECTION_REFUSED: 1003,
  // Message errors (2000-2099)
  MESSAGE_GENERIC: 2000,
  MESSAGE_TOO_LARGE: 2001,
  INVALID_FORMAT: 2002,
  UNKNOWN_TYPE: 2003,
  // Chat errors (3000-3099)
  CHAT_GENERIC: 3000,
  CHAT_NOT_FOUND: 3001,
  NOT_A_MEMBER: 3002,
  CHAT_FULL: 3003,
  // Media errors (4000-4099)
  MEDIA_GENERIC: 4000,
  MEDIA_NOT_SUPPORTED: 4001,
  QUALITY_NOT_AVAILABLE: 4002,
  TOO_MANY_STREAMS: 4003,
  // Security errors (5000-5099)
  SECURITY_GENERIC: 5000,
  INVALID_SIGNATURE: 5001,
  KEY_MISMATCH: 5002,
  DECRYPTION_FAILED: 5003,
} as const

// --- Helper to create messages ---

import { v4 as uuidv4 } from 'uuid'

export function createMessage<T extends MessageType>(
  type: T,
  from: string,
  to: string,
  payload: PayloadMap[T],
  chatId: string | null = null
): NeonP2PMessage<T> {
  return {
    version: PROTOCOL_VERSION,
    type,
    id: uuidv4(),
    from,
    to,
    chatId,
    timestamp: Date.now(),
    payload,
  }
}
