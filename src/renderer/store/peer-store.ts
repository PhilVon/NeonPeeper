import { create } from 'zustand'
import { PeerProfile, LocalProfile } from '../types/peer'

interface PeerState {
  localProfile: LocalProfile | null
  peers: Map<string, PeerProfile>

  setLocalProfile: (profile: LocalProfile) => void
  upsertPeer: (peer: PeerProfile) => void
  setPeerStatus: (peerId: string, lastSeen: number, status?: 'online' | 'busy' | 'idle') => void
  removePeer: (peerId: string) => void
  getOnlinePeers: () => PeerProfile[]
}

const ONLINE_THRESHOLD_MS = 60_000

export const usePeerStore = create<PeerState>((set, get) => ({
  localProfile: null,
  peers: new Map(),

  setLocalProfile: (profile) => set({ localProfile: profile }),

  upsertPeer: (peer) =>
    set((state) => {
      const peers = new Map(state.peers)
      peers.set(peer.id, peer)
      return { peers }
    }),

  setPeerStatus: (peerId, lastSeen, status?) =>
    set((state) => {
      const peers = new Map(state.peers)
      const existing = peers.get(peerId)
      if (existing) {
        peers.set(peerId, { ...existing, lastSeen, ...(status !== undefined ? { status } : {}) })
      }
      return { peers }
    }),

  removePeer: (peerId) =>
    set((state) => {
      const peers = new Map(state.peers)
      peers.delete(peerId)
      return { peers }
    }),

  getOnlinePeers: () => {
    const now = Date.now()
    const peers = get().peers
    return Array.from(peers.values()).filter(
      (p) => now - p.lastSeen < ONLINE_THRESHOLD_MS
    )
  },
}))
