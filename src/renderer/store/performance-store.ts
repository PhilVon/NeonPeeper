import { create } from 'zustand'
import type { ConnectionQuality } from '../types/media'

export interface PerformancePeerStats {
  peerId: string
  uploadBps: number
  downloadBps: number
  rttMs: number
  packetLoss: number
  quality: ConnectionQuality
}

interface PerformanceState {
  peerStats: Map<string, PerformancePeerStats>
  aggregateQuality: ConnectionQuality

  updatePeerStats: (peerId: string, stats: PerformancePeerStats) => void
  removePeerStats: (peerId: string) => void
  setAggregateQuality: (quality: ConnectionQuality) => void
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  peerStats: new Map(),
  aggregateQuality: 'good',

  updatePeerStats: (peerId, stats) =>
    set((state) => {
      const peerStats = new Map(state.peerStats)
      peerStats.set(peerId, stats)
      return { peerStats }
    }),

  removePeerStats: (peerId) =>
    set((state) => {
      const peerStats = new Map(state.peerStats)
      peerStats.delete(peerId)
      return { peerStats }
    }),

  setAggregateQuality: (quality) => set({ aggregateQuality: quality }),
}))
