import { getConnectionManager } from './ConnectionManager'
import type { ConnectionQuality } from '../types/media'

export interface PeerStats {
  peerId: string
  uploadBps: number
  downloadBps: number
  rttMs: number
  packetLoss: number
  jitter: number
  framesDropped: number
  quality: ConnectionQuality
}

interface RawStats {
  bytesSent: number
  bytesReceived: number
  packetsLost: number
  packetsReceived: number
  jitter: number
  framesDropped: number
  roundTripTime: number
  timestamp: number
}

export class PerformanceMonitor {
  private interval: ReturnType<typeof setInterval> | null = null
  private previousStats = new Map<string, RawStats>()
  private peerStats = new Map<string, PeerStats>()
  private listeners = new Set<(stats: Map<string, PeerStats>) => void>()

  // Adaptive bitrate state
  private badSamples = new Map<string, number>()
  private goodSamples = new Map<string, number>()
  private lastQualityChange = new Map<string, number>()

  start(intervalMs = 2000): void {
    this.stop()
    this.interval = setInterval(() => this.poll(), intervalMs)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  onStats(listener: (stats: Map<string, PeerStats>) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStats(): Map<string, PeerStats> {
    return this.peerStats
  }

  private async poll(): Promise<void> {
    const cm = getConnectionManager()
    const peerIds = cm.getConnectedPeerIds()

    for (const peerId of peerIds) {
      const pc = cm.getPeerConnection(peerId)
      if (!pc) continue

      try {
        const report = await pc.getStats()
        const stats = this.parseStats(peerId, report)
        if (stats) {
          this.peerStats.set(peerId, stats)
        }
      } catch {
        // Stats unavailable
      }
    }

    this.listeners.forEach((l) => l(this.peerStats))
  }

  private parseStats(peerId: string, report: RTCStatsReport): PeerStats | null {
    let bytesSent = 0
    let bytesReceived = 0
    let packetsLost = 0
    let packetsReceived = 0
    let jitter = 0
    let framesDropped = 0
    let roundTripTime = 0
    let timestamp = 0

    report.forEach((stat) => {
      if (stat.type === 'outbound-rtp') {
        bytesSent += stat.bytesSent ?? 0
        timestamp = stat.timestamp
      }
      if (stat.type === 'inbound-rtp') {
        bytesReceived += stat.bytesReceived ?? 0
        packetsLost += stat.packetsLost ?? 0
        packetsReceived += stat.packetsReceived ?? 0
        jitter = Math.max(jitter, stat.jitter ?? 0)
        framesDropped += stat.framesDropped ?? 0
      }
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        roundTripTime = stat.currentRoundTripTime ?? 0
      }
    })

    const prev = this.previousStats.get(peerId)
    this.previousStats.set(peerId, {
      bytesSent, bytesReceived, packetsLost, packetsReceived,
      jitter, framesDropped, roundTripTime, timestamp,
    })

    if (!prev) return null

    const dtMs = timestamp - prev.timestamp
    if (dtMs <= 0) return null

    const uploadBps = ((bytesSent - prev.bytesSent) * 8 * 1000) / dtMs
    const downloadBps = ((bytesReceived - prev.bytesReceived) * 8 * 1000) / dtMs
    const totalPackets = packetsReceived - prev.packetsReceived + packetsLost - prev.packetsLost
    const packetLoss = totalPackets > 0 ? (packetsLost - prev.packetsLost) / totalPackets : 0
    const rttMs = roundTripTime * 1000

    const quality = this.calculateQuality(packetLoss, rttMs)

    return {
      peerId,
      uploadBps,
      downloadBps,
      rttMs,
      packetLoss,
      jitter,
      framesDropped: framesDropped - prev.framesDropped,
      quality,
    }
  }

  private calculateQuality(packetLoss: number, rttMs: number): ConnectionQuality {
    if (packetLoss < 0.01 && rttMs < 50) return 'excellent'
    if (packetLoss < 0.03 && rttMs < 150) return 'good'
    if (packetLoss < 0.05 && rttMs < 300) return 'fair'
    return 'poor'
  }

  // Adaptive bitrate algorithm with hysteresis
  shouldDowngrade(peerId: string, packetLoss: number, rttMs: number): boolean {
    const BAD_THRESHOLD_LOSS = 0.05
    const BAD_THRESHOLD_RTT = 300
    const DOWNGRADE_SAMPLES = 3
    const MIN_INTERVAL_MS = 10_000

    const lastChange = this.lastQualityChange.get(peerId) ?? 0
    if (Date.now() - lastChange < MIN_INTERVAL_MS) return false

    if (packetLoss > BAD_THRESHOLD_LOSS || rttMs > BAD_THRESHOLD_RTT) {
      const count = (this.badSamples.get(peerId) ?? 0) + 1
      this.badSamples.set(peerId, count)
      this.goodSamples.set(peerId, 0)
      if (count >= DOWNGRADE_SAMPLES) {
        this.badSamples.set(peerId, 0)
        this.lastQualityChange.set(peerId, Date.now())
        return true
      }
    } else {
      this.badSamples.set(peerId, 0)
    }
    return false
  }

  shouldUpgrade(peerId: string, packetLoss: number, rttMs: number): boolean {
    const GOOD_THRESHOLD_LOSS = 0.01
    const GOOD_THRESHOLD_RTT = 100
    const UPGRADE_SAMPLES = 10
    const MIN_INTERVAL_MS = 10_000

    const lastChange = this.lastQualityChange.get(peerId) ?? 0
    if (Date.now() - lastChange < MIN_INTERVAL_MS) return false

    if (packetLoss < GOOD_THRESHOLD_LOSS && rttMs < GOOD_THRESHOLD_RTT) {
      const count = (this.goodSamples.get(peerId) ?? 0) + 1
      this.goodSamples.set(peerId, count)
      this.badSamples.set(peerId, 0)
      if (count >= UPGRADE_SAMPLES) {
        this.goodSamples.set(peerId, 0)
        this.lastQualityChange.set(peerId, Date.now())
        return true
      }
    } else {
      this.goodSamples.set(peerId, 0)
    }
    return false
  }
}

let performanceMonitorInstance: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor()
  }
  return performanceMonitorInstance
}
