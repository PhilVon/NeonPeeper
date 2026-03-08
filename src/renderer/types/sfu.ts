/**
 * SFU signaling message types that flow over the existing WebSocket.
 * These are separate from the P2P DataChannel protocol (NEONP2P/1.0).
 */

export type SFUMessageType =
  | 'sfu-join'
  | 'sfu-joined'
  | 'sfu-leave'
  | 'sfu-create-transport'
  | 'sfu-transport-created'
  | 'sfu-connect-transport'
  | 'sfu-produce'
  | 'sfu-produced'
  | 'sfu-consume'
  | 'sfu-consumed'
  | 'sfu-resume-consumer'
  | 'sfu-close-producer'
  | 'sfu-set-preferred-layers'
  | 'sfu-pause-consumer'
  | 'sfu-new-producer'
  | 'sfu-producer-closed'
  | 'sfu-active-speaker'

export interface SFUMessage {
  type: SFUMessageType
  requestId?: string
  roomId?: string
  peerId?: string
  data?: Record<string, unknown>
}

export interface SFUTransportOptions {
  id: string
  iceParameters: Record<string, unknown>
  iceCandidates: Record<string, unknown>[]
  dtlsParameters: Record<string, unknown>
}

export interface SFUProducerInfo {
  producerId: string
  peerId: string
  kind: 'audio' | 'video'
}

export interface SFUConsumerInfo {
  consumerId: string
  producerId: string
  peerId: string
  kind: 'audio' | 'video'
  rtpParameters: Record<string, unknown>
}
