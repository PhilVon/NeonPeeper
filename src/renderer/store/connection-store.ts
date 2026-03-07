import { create } from 'zustand'
import { ConnectionState } from '../types/peer'

export interface PeerConnectionInfo {
  peerId: string
  connectionState: ConnectionState
  iceState: RTCIceConnectionState | null
  dataChannelState: RTCDataChannelState | null
  reconnectAttempts: number
  lastPingSeq: number
  lastPongTime: number
  missedPongs: number
  rttMs: number | null
  signalingState: 'disconnected' | 'connecting' | 'connected' | 'error'
}

interface ConnectionStoreState {
  connections: Map<string, PeerConnectionInfo>

  upsertConnection: (info: Partial<PeerConnectionInfo> & { peerId: string }) => void
  setConnectionState: (peerId: string, state: ConnectionState) => void
  setIceState: (peerId: string, state: RTCIceConnectionState) => void
  setDataChannelState: (peerId: string, state: RTCDataChannelState) => void
  incrementReconnectAttempts: (peerId: string) => void
  resetReconnectAttempts: (peerId: string) => void
  updatePingPong: (peerId: string, update: Partial<Pick<PeerConnectionInfo, 'lastPingSeq' | 'lastPongTime' | 'missedPongs' | 'rttMs'>>) => void
  removeConnection: (peerId: string) => void
  getConnection: (peerId: string) => PeerConnectionInfo | undefined
}

function defaultConnectionInfo(peerId: string): PeerConnectionInfo {
  return {
    peerId,
    connectionState: 'disconnected',
    iceState: null,
    dataChannelState: null,
    reconnectAttempts: 0,
    lastPingSeq: 0,
    lastPongTime: 0,
    missedPongs: 0,
    rttMs: null,
    signalingState: 'disconnected',
  }
}

export const useConnectionStore = create<ConnectionStoreState>((set, get) => ({
  connections: new Map(),

  upsertConnection: (info) =>
    set((state) => {
      const connections = new Map(state.connections)
      const existing = connections.get(info.peerId) ?? defaultConnectionInfo(info.peerId)
      connections.set(info.peerId, { ...existing, ...info })
      return { connections }
    }),

  setConnectionState: (peerId, connectionState) =>
    set((state) => {
      const connections = new Map(state.connections)
      const existing = connections.get(peerId) ?? defaultConnectionInfo(peerId)
      connections.set(peerId, { ...existing, connectionState })
      return { connections }
    }),

  setIceState: (peerId, iceState) =>
    set((state) => {
      const connections = new Map(state.connections)
      const existing = connections.get(peerId) ?? defaultConnectionInfo(peerId)
      connections.set(peerId, { ...existing, iceState })
      return { connections }
    }),

  setDataChannelState: (peerId, dataChannelState) =>
    set((state) => {
      const connections = new Map(state.connections)
      const existing = connections.get(peerId) ?? defaultConnectionInfo(peerId)
      connections.set(peerId, { ...existing, dataChannelState })
      return { connections }
    }),

  incrementReconnectAttempts: (peerId) =>
    set((state) => {
      const connections = new Map(state.connections)
      const existing = connections.get(peerId) ?? defaultConnectionInfo(peerId)
      connections.set(peerId, { ...existing, reconnectAttempts: existing.reconnectAttempts + 1 })
      return { connections }
    }),

  resetReconnectAttempts: (peerId) =>
    set((state) => {
      const connections = new Map(state.connections)
      const existing = connections.get(peerId) ?? defaultConnectionInfo(peerId)
      connections.set(peerId, { ...existing, reconnectAttempts: 0 })
      return { connections }
    }),

  updatePingPong: (peerId, update) =>
    set((state) => {
      const connections = new Map(state.connections)
      const existing = connections.get(peerId) ?? defaultConnectionInfo(peerId)
      connections.set(peerId, { ...existing, ...update })
      return { connections }
    }),

  removeConnection: (peerId) =>
    set((state) => {
      const connections = new Map(state.connections)
      connections.delete(peerId)
      return { connections }
    }),

  getConnection: (peerId) => get().connections.get(peerId),
}))
