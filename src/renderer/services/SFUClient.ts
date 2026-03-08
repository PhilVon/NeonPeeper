/**
 * SFU Client for mediasoup integration (Phase 8)
 *
 * Handles connection to a mediasoup SFU server for 7+ peer video
 * with simulcast (low/mid/high layers).
 *
 * BLOCKED: Requires mediasoup-client package and a running mediasoup server.
 * Install with: npm install mediasoup-client
 * Once installed, uncomment the mediasoup-client imports and implement
 * the Device/Transport/Producer/Consumer lifecycle.
 */

import type { QualityPreset } from '../types/protocol'

// import { Device, types as mediasoupTypes } from 'mediasoup-client'

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

export class SFUClient {
  serverUrl: string = ''
  private connected = false
  private ws: WebSocket | null = null
  private eventListeners = new Map<string, Set<EventCallback>>()
  // private device: Device | null = null
  // private sendTransport: mediasoupTypes.Transport | null = null
  // private recvTransport: mediasoupTypes.Transport | null = null
  private producers = new Map<string, string>() // trackId -> producerId
  private consumers = new Map<string, MediaStreamTrack>() // consumerId -> track

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

  async connect(url: string): Promise<void> {
    this.serverUrl = url

    // BLOCKED: Requires mediasoup server
    // Implementation would be:
    // 1. Connect WebSocket to SFU server
    // 2. Request router RTP capabilities
    // 3. Load mediasoup-client Device with capabilities
    // 4. Create send and receive transports
    //
    // this.ws = new WebSocket(url)
    // this.ws.onopen = () => { ... request capabilities ... }
    // this.ws.onmessage = (event) => { ... handle signaling ... }
    //
    // const routerCapabilities = await this.request('getRouterRtpCapabilities')
    // this.device = new Device()
    // await this.device.load({ routerRtpCapabilities: routerCapabilities })
    //
    // this.sendTransport = this.device.createSendTransport(sendTransportInfo)
    // this.recvTransport = this.device.createRecvTransport(recvTransportInfo)

    console.log('[SFUClient] Connect to:', url, '(stub — mediasoup server required)')
    this.connected = true
    this.emit('connected')
  }

  async disconnect(): Promise<void> {
    // Close all producers and consumers
    this.producers.clear()
    for (const track of this.consumers.values()) {
      track.stop()
    }
    this.consumers.clear()

    // this.sendTransport?.close()
    // this.recvTransport?.close()
    // this.sendTransport = null
    // this.recvTransport = null
    // this.device = null

    this.ws?.close()
    this.ws = null
    this.connected = false
    this.emit('disconnected')
    console.log('[SFUClient] Disconnected')
  }

  isConnected(): boolean {
    return this.connected
  }

  async produce(track: MediaStreamTrack, simulcast = true): Promise<string> {
    // BLOCKED: Requires mediasoup-client
    // Implementation:
    // const producer = await this.sendTransport.produce({
    //   track,
    //   encodings: simulcast ? SIMULCAST_ENCODINGS.map(l => ({
    //     rid: l.rid,
    //     maxBitrate: l.maxBitrate,
    //     maxFramerate: l.maxFramerate,
    //     scaleResolutionDownBy: l.scaleResolutionDownBy,
    //   })) : undefined,
    //   codecOptions: { videoGoogleStartBitrate: 1000 },
    // })
    // this.producers.set(track.id, producer.id)
    // return producer.id

    const producerId = `producer-${track.id}-${Date.now()}`
    this.producers.set(track.id, producerId)
    console.log('[SFUClient] Produce track:', track.kind, simulcast ? '(simulcast)' : '', '(stub)')
    return producerId
  }

  async consume(producerId: string): Promise<MediaStreamTrack | null> {
    // BLOCKED: Requires mediasoup-client
    // Implementation:
    // const consumer = await this.recvTransport.consume({
    //   producerId,
    //   rtpCapabilities: this.device.rtpCapabilities,
    // })
    // this.consumers.set(consumer.id, consumer.track)
    // await this.request('resumeConsumer', { consumerId: consumer.id })
    // return consumer.track

    console.log('[SFUClient] Consume producer:', producerId, '(stub)')
    return null
  }

  async setPreferredLayer(consumerId: string, layer: 'low' | 'mid' | 'high'): Promise<void> {
    // BLOCKED: Requires mediasoup-client
    // Implementation:
    // const spatialLayer = layer === 'low' ? 0 : layer === 'mid' ? 1 : 2
    // await this.request('setConsumerPreferredLayers', {
    //   consumerId,
    //   spatialLayer,
    //   temporalLayer: 2,
    // })

    console.log('[SFUClient] Set preferred layer:', consumerId, layer, '(stub)')
  }

  async stopProducing(trackId: string): Promise<void> {
    const producerId = this.producers.get(trackId)
    if (!producerId) return

    // await this.request('closeProducer', { producerId })
    this.producers.delete(trackId)
    console.log('[SFUClient] Stop producing:', trackId, '(stub)')
  }

  getProducerCount(): number {
    return this.producers.size
  }

  getConsumerCount(): number {
    return this.consumers.size
  }
}

let sfuClientInstance: SFUClient | null = null

export function getSFUClient(): SFUClient {
  if (!sfuClientInstance) {
    sfuClientInstance = new SFUClient()
  }
  return sfuClientInstance
}
