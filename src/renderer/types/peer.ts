export interface PeerProfile {
  id: string
  displayName: string
  publicKey: string
  capabilities: string[]
  firstSeen: number
  lastSeen: number
  status?: 'online' | 'busy' | 'idle'
}

export interface LocalProfile {
  id: string
  displayName: string
  publicKey: string
  privateKey?: CryptoKey
  capabilities: string[]
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'signaling'
  | 'ice-checking'
  | 'dtls-handshake'
  | 'handshake'
  | 'connected'
  | 'reconnecting'
  | 'failed'

export interface ManualConnectionData {
  sdp: string
  iceCandidates: RTCIceCandidateInit[]
  peerId: string
}

export interface ReconnectionConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
}
