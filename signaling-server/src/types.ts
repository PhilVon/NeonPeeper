/**
 * Server-side SFU signaling types (no client dependency).
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
