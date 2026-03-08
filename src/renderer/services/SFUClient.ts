/**
 * SFU Client for mediasoup integration (Phase 8)
 *
 * Handles connection to a mediasoup SFU server for 7+ peer video
 * with simulcast (low/mid/high layers).
 */

import { Device, types as mediasoupTypes } from 'mediasoup-client'
import type { QualityPreset } from '../types/protocol'
import type { SFUMessage } from '../types/sfu'
import { getSignalingClient } from './SignalingClient'
import { useMediaStore } from '../store/media-store'

export interface SimulcastLayer {
  rid: string
  maxBitrate: number
  maxFramerate: number
  scaleResolutionDownBy: number
}

export const SIMULCAST_ENCODINGS: SimulcastLayer[] = [
  { rid: 'low', maxBitrate: 200_000, maxFramerate: 15, scaleResolutionDownBy: 4 },
  { rid: 'mid', maxBitrate: 800_000, maxFramerate: 24, scaleResolutionDownBy: 2 },
  { rid: 'high', maxBitrate: 2_000_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
]

export const SFU_CONSTANTS = {
  TOPOLOGY_THRESHOLD: 7,
  HYSTERESIS_THRESHOLD: 5,
  ACTIVE_SPEAKER_INTERVAL_MS: 2000,
  REQUEST_TIMEOUT_MS: 10_000,
}

export type Topology = 'direct' | 'mesh' | 'sfu'

export function selectTopology(memberCount: number): Topology {
  if (memberCount <= 2) return 'direct'
  if (memberCount <= 6) return 'mesh'
  return 'sfu'
}

export function getAutoQuality(peerCount: number): QualityPreset {
  if (peerCount <= 2) return 'high'
  if (peerCount <= 4) return 'medium'
  return 'low'
}

type EventCallback = (...args: unknown[]) => void

interface PendingRequest {
  resolve: (data: Record<string, unknown>) => void
  reject: (err: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

interface ConsumerInfo {
  consumer: mediasoupTypes.Consumer
  peerId: string
  producerId: string
}

export class SFUClient {
  serverUrl: string = ''
  private connected = false
  private eventListeners = new Map<string, Set<EventCallback>>()
  private device: Device | null = null
  private sendTransport: mediasoupTypes.Transport | null = null
  private recvTransport: mediasoupTypes.Transport | null = null
  private producers = new Map<string, mediasoupTypes.Producer>() // trackId -> Producer
  private consumers = new Map<string, ConsumerInfo>() // consumerId -> info
  private pendingRequests = new Map<string, PendingRequest>()
  private roomId: string | null = null

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  off(event: string, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback)
  }

  private emit(event: string, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((cb) => cb(...args))
  }

  async connect(roomId: string): Promise<void> {
    this.roomId = roomId

    try {
      // Send sfu-join via signaling, get router RTP capabilities back
      const response = await this.request('sfu-join', { roomId })
      const routerRtpCapabilities = response.routerRtpCapabilities as mediasoupTypes.RtpCapabilities

      // Load mediasoup Device
      this.device = new Device()
      await this.device.load({ routerRtpCapabilities })

      // Create send transport
      const sendTransportData = await this.request('sfu-create-transport', {
        roomId,
        direction: 'send',
      })
      this.sendTransport = this.device.createSendTransport({
        id: sendTransportData.id as string,
        iceParameters: sendTransportData.iceParameters as mediasoupTypes.IceParameters,
        iceCandidates: sendTransportData.iceCandidates as mediasoupTypes.IceCandidate[],
        dtlsParameters: sendTransportData.dtlsParameters as mediasoupTypes.DtlsParameters,
      })
      this.wireSendTransport(this.sendTransport)

      // Create recv transport
      const recvTransportData = await this.request('sfu-create-transport', {
        roomId,
        direction: 'recv',
      })
      this.recvTransport = this.device.createRecvTransport({
        id: recvTransportData.id as string,
        iceParameters: recvTransportData.iceParameters as mediasoupTypes.IceParameters,
        iceCandidates: recvTransportData.iceCandidates as mediasoupTypes.IceCandidate[],
        dtlsParameters: recvTransportData.dtlsParameters as mediasoupTypes.DtlsParameters,
      })
      this.wireRecvTransport(this.recvTransport)

      this.connected = true
      this.emit('connected')
      console.log('[SFUClient] Connected to SFU room:', roomId)
    } catch (err) {
      console.error('[SFUClient] Failed to connect:', err)
      this.emit('error', err)
      throw err
    }
  }

  async disconnect(): Promise<void> {
    // Close all producers
    for (const [, producer] of this.producers) {
      producer.close()
    }
    this.producers.clear()

    // Close all consumers
    for (const [, info] of this.consumers) {
      info.consumer.close()
    }
    this.consumers.clear()

    // Close transports
    this.sendTransport?.close()
    this.recvTransport?.close()
    this.sendTransport = null
    this.recvTransport = null
    this.device = null

    // Notify server
    if (this.roomId) {
      try {
        await this.request('sfu-leave', { roomId: this.roomId })
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Clear pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Disconnected'))
    }
    this.pendingRequests.clear()

    this.roomId = null
    this.connected = false
    this.emit('disconnected')
    console.log('[SFUClient] Disconnected')
  }

  isConnected(): boolean {
    return this.connected
  }

  async produce(track: MediaStreamTrack, simulcast = true): Promise<string> {
    if (!this.sendTransport) throw new Error('No send transport')

    const encodings = simulcast && track.kind === 'video'
      ? SIMULCAST_ENCODINGS.map((l) => ({
        rid: l.rid,
        maxBitrate: l.maxBitrate,
        maxFramerate: l.maxFramerate,
        scaleResolutionDownBy: l.scaleResolutionDownBy,
      }))
      : undefined

    const codecOptions = track.kind === 'video'
      ? { videoGoogleStartBitrate: 1000 }
      : undefined

    const producer = await this.sendTransport.produce({
      track,
      encodings,
      codecOptions,
    })

    this.producers.set(track.id, producer)

    producer.on('transportclose', () => {
      this.producers.delete(track.id)
    })

    console.log('[SFUClient] Producing:', track.kind, simulcast ? '(simulcast)' : '')
    return producer.id
  }

  async consume(producerId: string, peerId: string, kind: 'audio' | 'video', rtpParameters: mediasoupTypes.RtpParameters): Promise<mediasoupTypes.Consumer | null> {
    if (!this.recvTransport || !this.device) return null

    try {
      const consumer = await this.recvTransport.consume({
        id: crypto.randomUUID(),
        producerId,
        kind,
        rtpParameters,
      })

      this.consumers.set(consumer.id, { consumer, peerId, producerId })

      // Resume consumer on server
      this.request('sfu-resume-consumer', {
        roomId: this.roomId,
        consumerId: consumer.id,
      }).catch((err) => console.error('[SFUClient] Failed to resume consumer:', err))

      // Update media store
      const stream = new MediaStream([consumer.track])
      useMediaStore.getState().addRemoteStream(peerId, stream)
      useMediaStore.getState().addSFUConsumer(consumer.id, { peerId, kind, paused: false })

      consumer.on('transportclose', () => {
        this.consumers.delete(consumer.id)
        useMediaStore.getState().removeSFUConsumer(consumer.id)
      })

      this.emit('consumer-created', consumer.id, peerId, kind, consumer.track)
      return consumer
    } catch (err) {
      console.error('[SFUClient] Failed to consume:', err)
      return null
    }
  }

  async setPreferredLayer(consumerId: string, layer: 'low' | 'mid' | 'high'): Promise<void> {
    const spatialLayer = layer === 'low' ? 0 : layer === 'mid' ? 1 : 2
    await this.request('sfu-set-preferred-layers', {
      roomId: this.roomId,
      consumerId,
      spatialLayer,
      temporalLayer: 2,
    })
  }

  async pauseConsumer(consumerId: string): Promise<void> {
    const info = this.consumers.get(consumerId)
    if (!info) return

    info.consumer.pause()
    useMediaStore.getState().pauseSFUConsumer(consumerId)

    await this.request('sfu-pause-consumer', {
      roomId: this.roomId,
      consumerId,
    }).catch((err) => console.error('[SFUClient] Failed to pause consumer:', err))
  }

  async resumeConsumer(consumerId: string): Promise<void> {
    const info = this.consumers.get(consumerId)
    if (!info) return

    info.consumer.resume()
    useMediaStore.getState().resumeSFUConsumer(consumerId)

    await this.request('sfu-resume-consumer', {
      roomId: this.roomId,
      consumerId,
    }).catch((err) => console.error('[SFUClient] Failed to resume consumer:', err))
  }

  async stopProducing(trackId: string): Promise<void> {
    const producer = this.producers.get(trackId)
    if (!producer) return

    producer.close()
    this.producers.delete(trackId)

    await this.request('sfu-close-producer', {
      roomId: this.roomId,
      producerId: producer.id,
    }).catch((err) => console.error('[SFUClient] Failed to close producer:', err))
  }

  selectLayerForConsumer(_consumerId: string, context: { isActiveSpeaker: boolean; tileSize: 'large' | 'medium' | 'small' }): 'low' | 'mid' | 'high' {
    if (context.isActiveSpeaker || context.tileSize === 'large') return 'high'
    if (context.tileSize === 'medium') return 'mid'
    return 'low'
  }

  handleServerMessage(msg: SFUMessage): void {
    const { type, requestId, data } = msg

    // Handle request/response correlation
    if (requestId && this.pendingRequests.has(requestId)) {
      const pending = this.pendingRequests.get(requestId)!
      this.pendingRequests.delete(requestId)
      clearTimeout(pending.timeout)

      if (type === ('sfu-error' as SFUMessage['type'])) {
        pending.reject(new Error((data?.message as string) || 'SFU error'))
      } else {
        pending.resolve(data || {})
      }
      return
    }

    // Handle server-initiated messages
    switch (type) {
      case 'sfu-new-producer': {
        const producerId = data?.producerId as string
        const peerId = data?.peerId as string
        const kind = data?.kind as 'audio' | 'video'
        this.emit('new-producer', producerId, peerId, kind)

        // Auto-consume new producers
        if (this.device && this.recvTransport) {
          this.request('sfu-consume', {
            roomId: this.roomId,
            producerId,
            rtpCapabilities: this.device.rtpCapabilities,
          }).then((consumerData) => {
            this.consume(
              producerId,
              peerId,
              kind,
              consumerData.rtpParameters as mediasoupTypes.RtpParameters
            )
          }).catch((err) => console.error('[SFUClient] Auto-consume failed:', err))
        }
        break
      }

      case 'sfu-producer-closed': {
        const producerId = data?.producerId as string
        for (const [consumerId, info] of this.consumers) {
          if (info.producerId === producerId) {
            info.consumer.close()
            this.consumers.delete(consumerId)
            useMediaStore.getState().removeSFUConsumer(consumerId)
            useMediaStore.getState().removeRemoteStream(info.peerId)
            this.emit('consumer-closed', consumerId, info.peerId)
            break
          }
        }
        break
      }

      case 'sfu-active-speaker': {
        const peerId = data?.peerId as string | null
        useMediaStore.getState().setActiveSpeaker(peerId)
        this.emit('active-speaker', peerId)

        // Auto-adjust layers for active speaker
        if (peerId) {
          for (const [consumerId, info] of this.consumers) {
            if (info.consumer.kind === 'video') {
              const layer = info.peerId === peerId ? 'high' : 'low'
              this.setPreferredLayer(consumerId, layer).catch(() => {})
            }
          }
        }
        break
      }
    }
  }

  async request(type: string, data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID()

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`SFU request timeout: ${type}`))
      }, SFU_CONSTANTS.REQUEST_TIMEOUT_MS)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      const msg: SFUMessage = {
        type: type as SFUMessage['type'],
        requestId,
        data,
      }

      getSignalingClient().sendSFUMessage(msg)
    })
  }

  private wireSendTransport(transport: mediasoupTypes.Transport): void {
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.request('sfu-connect-transport', {
        roomId: this.roomId,
        transportId: transport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback)
    })

    transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
      this.request('sfu-produce', {
        roomId: this.roomId,
        transportId: transport.id,
        kind,
        rtpParameters,
      })
        .then((response) => callback({ id: response.producerId as string }))
        .catch(errback)
    })
  }

  private wireRecvTransport(transport: mediasoupTypes.Transport): void {
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.request('sfu-connect-transport', {
        roomId: this.roomId,
        transportId: transport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback)
    })
  }

  getProducerCount(): number {
    return this.producers.size
  }

  getConsumerCount(): number {
    return this.consumers.size
  }

  getConsumerInfo(consumerId: string): ConsumerInfo | undefined {
    return this.consumers.get(consumerId)
  }

  getRoomId(): string | null {
    return this.roomId
  }
}

let sfuClientInstance: SFUClient | null = null

export function getSFUClient(): SFUClient {
  if (!sfuClientInstance) {
    sfuClientInstance = new SFUClient()
  }
  return sfuClientInstance
}
