/**
 * SFU Client for mediasoup integration (Phase 8)
 *
 * Handles connection to a mediasoup SFU server for 7+ peer video
 * with simulcast (low/mid/high layers).
 *
 * This is a stub that will be fully implemented when mediasoup-client
 * is added as a dependency. For now, it defines the interface and
 * topology selection logic.
 */

import type { QualityPreset } from '../types/protocol'

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

export class SFUClient {
  serverUrl: string = ''
  private connected = false

  async connect(url: string): Promise<void> {
    this.serverUrl = url
    // TODO: Implement mediasoup-client Device creation and transport setup
    console.log('[SFUClient] Connect to:', url)
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
    console.log('[SFUClient] Disconnected')
  }

  isConnected(): boolean {
    return this.connected
  }

  async produce(_track: MediaStreamTrack, _simulcast = true): Promise<string> {
    // TODO: Create mediasoup producer with simulcast encodings
    console.log('[SFUClient] Produce track')
    return 'producer-id-stub'
  }

  async consume(_producerId: string): Promise<MediaStreamTrack | null> {
    // TODO: Create mediasoup consumer
    console.log('[SFUClient] Consume producer:', _producerId)
    return null
  }

  async setPreferredLayer(_consumerId: string, _layer: 'low' | 'mid' | 'high'): Promise<void> {
    // TODO: Request specific simulcast layer from SFU
    console.log('[SFUClient] Set preferred layer')
  }
}

let sfuClientInstance: SFUClient | null = null

export function getSFUClient(): SFUClient {
  if (!sfuClientInstance) {
    sfuClientInstance = new SFUClient()
  }
  return sfuClientInstance
}
