import * as mediasoup from 'mediasoup'
import type { RtpCodecCapability } from 'mediasoup/node/lib/rtpParametersTypes'

// RouterOptions.mediaCodecs accepts RtpCodecCapability with optional preferredPayloadType
const MEDIA_CODECS: RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    preferredPayloadType: 111,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {},
    preferredPayloadType: 96,
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
    },
    preferredPayloadType: 125,
  },
]

interface PeerTransports {
  sendTransport: mediasoup.types.WebRtcTransport | null
  recvTransport: mediasoup.types.WebRtcTransport | null
  producers: Map<string, mediasoup.types.Producer>
  consumers: Map<string, mediasoup.types.Consumer>
}

export type SendCallback = (peerId: string, data: Record<string, unknown>) => void

export class SFURoom {
  readonly id: string
  private router: mediasoup.types.Router
  private peers = new Map<string, PeerTransports>()
  private audioLevelObserver: mediasoup.types.AudioLevelObserver | null = null
  private sendToPeer: SendCallback

  constructor(id: string, router: mediasoup.types.Router, sendToPeer: SendCallback) {
    this.id = id
    this.router = router
    this.sendToPeer = sendToPeer
  }

  getRouterRtpCapabilities(): mediasoup.types.RtpCapabilities {
    return this.router.rtpCapabilities
  }

  getPeerCount(): number {
    return this.peers.size
  }

  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId)
  }

  addPeer(peerId: string): void {
    if (this.peers.has(peerId)) return
    this.peers.set(peerId, {
      sendTransport: null,
      recvTransport: null,
      producers: new Map(),
      consumers: new Map(),
    })
  }

  async createTransport(peerId: string, direction: 'send' | 'recv', listenIps?: mediasoup.types.TransportListenIp[]): Promise<Record<string, unknown>> {
    const peer = this.peers.get(peerId)
    if (!peer) throw new Error(`Peer ${peerId} not in room`)

    const transport = await this.router.createWebRtcTransport({
      listenIps: listenIps || [{ ip: '0.0.0.0', announcedIp: undefined }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    })

    if (direction === 'send') {
      peer.sendTransport = transport
    } else {
      peer.recvTransport = transport
    }

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    }
  }

  async connectTransport(transportId: string, dtlsParameters: mediasoup.types.DtlsParameters): Promise<void> {
    const transport = this.findTransport(transportId)
    if (!transport) throw new Error(`Transport ${transportId} not found`)
    await transport.connect({ dtlsParameters })
  }

  async produce(peerId: string, transportId: string, kind: mediasoup.types.MediaKind, rtpParameters: mediasoup.types.RtpParameters): Promise<string> {
    const peer = this.peers.get(peerId)
    if (!peer) throw new Error(`Peer ${peerId} not in room`)

    const transport = this.findTransport(transportId)
    if (!transport) throw new Error(`Transport ${transportId} not found`)

    const producer = await transport.produce({ kind, rtpParameters })
    peer.producers.set(producer.id, producer)

    producer.on('transportclose', () => {
      peer.producers.delete(producer.id)
    })

    // Notify other peers about new producer
    for (const [otherPeerId] of this.peers) {
      if (otherPeerId === peerId) continue
      this.sendToPeer(otherPeerId, {
        type: 'sfu-new-producer',
        data: {
          producerId: producer.id,
          peerId,
          kind,
        },
      })
    }

    // Add to audio level observer if audio
    if (kind === 'audio' && this.audioLevelObserver) {
      this.audioLevelObserver.addProducer({ producerId: producer.id })
        .catch(() => {})
    }

    return producer.id
  }

  async consume(peerId: string, producerId: string, rtpCapabilities: mediasoup.types.RtpCapabilities): Promise<Record<string, unknown>> {
    const peer = this.peers.get(peerId)
    if (!peer || !peer.recvTransport) throw new Error(`Peer ${peerId} has no recv transport`)

    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume: incompatible RTP capabilities')
    }

    const consumer = await peer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    })

    peer.consumers.set(consumer.id, consumer)

    consumer.on('transportclose', () => {
      peer.consumers.delete(consumer.id)
    })

    consumer.on('producerclose', () => {
      peer.consumers.delete(consumer.id)
      this.sendToPeer(peerId, {
        type: 'sfu-producer-closed',
        data: { producerId, consumerId: consumer.id },
      })
    })

    // Find who owns this producer
    let producerPeerId = ''
    for (const [pid, peerData] of this.peers) {
      if (peerData.producers.has(producerId)) {
        producerPeerId = pid
        break
      }
    }

    return {
      consumerId: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      peerId: producerPeerId,
    }
  }

  async resumeConsumer(consumerId: string): Promise<void> {
    const consumer = this.findConsumer(consumerId)
    if (!consumer) throw new Error(`Consumer ${consumerId} not found`)
    await consumer.resume()
  }

  async pauseConsumer(consumerId: string): Promise<void> {
    const consumer = this.findConsumer(consumerId)
    if (!consumer) throw new Error(`Consumer ${consumerId} not found`)
    await consumer.pause()
  }

  async setPreferredLayers(consumerId: string, spatialLayer: number, temporalLayer?: number): Promise<void> {
    const consumer = this.findConsumer(consumerId)
    if (!consumer) throw new Error(`Consumer ${consumerId} not found`)
    await consumer.setPreferredLayers({ spatialLayer, temporalLayer })
  }

  removeProducer(producerId: string): void {
    for (const [, peer] of this.peers) {
      const producer = peer.producers.get(producerId)
      if (producer) {
        producer.close()
        peer.producers.delete(producerId)
        break
      }
    }
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId)
    if (!peer) return

    // Close all consumers
    for (const [, consumer] of peer.consumers) {
      consumer.close()
    }

    // Close all producers
    for (const [, producer] of peer.producers) {
      producer.close()
    }

    // Close transports
    peer.sendTransport?.close()
    peer.recvTransport?.close()

    this.peers.delete(peerId)
  }

  async setupAudioLevelObserver(): Promise<void> {
    this.audioLevelObserver = await this.router.createAudioLevelObserver({
      maxEntries: 1,
      threshold: -50,
      interval: 2000,
    })

    this.audioLevelObserver.on('volumes', (volumes: Array<{ producer: mediasoup.types.Producer; volume: number }>) => {
      if (volumes.length === 0) return
      const topProducer = volumes[0].producer

      // Find which peer owns this producer
      let speakerPeerId: string | null = null
      for (const [peerId, peer] of this.peers) {
        if (peer.producers.has(topProducer.id)) {
          speakerPeerId = peerId
          break
        }
      }

      if (speakerPeerId) {
        for (const [peerId] of this.peers) {
          this.sendToPeer(peerId, {
            type: 'sfu-active-speaker',
            data: { peerId: speakerPeerId },
          })
        }
      }
    })

    this.audioLevelObserver.on('silence', () => {
      for (const [peerId] of this.peers) {
        this.sendToPeer(peerId, {
          type: 'sfu-active-speaker',
          data: { peerId: null },
        })
      }
    })
  }

  close(): void {
    for (const [peerId] of this.peers) {
      this.removePeer(peerId)
    }
    this.audioLevelObserver?.close()
    this.router.close()
  }

  private findTransport(transportId: string): mediasoup.types.WebRtcTransport | null {
    for (const [, peer] of this.peers) {
      if (peer.sendTransport?.id === transportId) return peer.sendTransport
      if (peer.recvTransport?.id === transportId) return peer.recvTransport
    }
    return null
  }

  private findConsumer(consumerId: string): mediasoup.types.Consumer | null {
    for (const [, peer] of this.peers) {
      const consumer = peer.consumers.get(consumerId)
      if (consumer) return consumer
    }
    return null
  }
}

export async function createRoom(worker: mediasoup.types.Worker, roomId: string, sendToPeer: SendCallback): Promise<SFURoom> {
  const router = await worker.createRouter({ mediaCodecs: MEDIA_CODECS })
  const room = new SFURoom(roomId, router, sendToPeer)
  await room.setupAudioLevelObserver()
  return room
}
