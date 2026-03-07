import { usePeerStore } from '../store/peer-store'
import { getConnectionManager } from './ConnectionManager'
import { toast } from '../store/toast-store'

type SignalingState = 'disconnected' | 'connecting' | 'connected' | 'error'
type EventCallback = (...args: unknown[]) => void

interface DiscoveredPeer {
  peerId: string
  displayName: string
}

export class SignalingClient {
  private ws: WebSocket | null = null
  private url: string = ''
  private state: SignalingState = 'disconnected'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private eventListeners = new Map<string, Set<EventCallback>>()
  private discoveredPeers: DiscoveredPeer[] = []
  private _destroyed = false

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

  getState(): SignalingState {
    return this.state
  }

  getDiscoveredPeers(): DiscoveredPeer[] {
    return this.discoveredPeers
  }

  connect(url: string): void {
    if (this._destroyed) return
    this.url = url
    this.setState('connecting')

    try {
      this.ws = new WebSocket(url)
    } catch (err) {
      this.setState('error')
      return
    }

    this.ws.onopen = () => {
      this.setState('connected')
      this.reconnectAttempts = 0

      // Register
      const profile = usePeerStore.getState().localProfile
      if (profile) {
        this.send({
          type: 'register',
          peerId: profile.id,
          displayName: profile.displayName,
        })
      }
    }

    this.ws.onmessage = (event) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }

      this.handleMessage(msg)
    }

    this.ws.onclose = () => {
      this.setState('disconnected')
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.setState('error')
    }
  }

  disconnect(): void {
    this._destroyed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setState('disconnected')
  }

  discover(): void {
    this.send({ type: 'discover' })
  }

  sendSignal(msg: { type: string; to: string; sdp?: string; candidate?: RTCIceCandidateInit }): void {
    this.send(msg)
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string

    switch (type) {
      case 'registered':
        this.emit('registered', msg.peerId)
        // Auto-discover after registration
        this.discover()
        break

      case 'peer-list':
        this.discoveredPeers = (msg.peers as DiscoveredPeer[]) || []
        this.emit('peer-list', this.discoveredPeers)

        // Update peer store with discovered peers
        for (const peer of this.discoveredPeers) {
          const existing = usePeerStore.getState().peers.get(peer.peerId)
          if (!existing) {
            usePeerStore.getState().upsertPeer({
              id: peer.peerId,
              displayName: peer.displayName,
              publicKey: '',
              capabilities: [],
              firstSeen: Date.now(),
              lastSeen: Date.now(),
            })
          } else {
            usePeerStore.getState().setPeerStatus(peer.peerId, Date.now())
          }
        }
        break

      case 'offer': {
        const from = msg.from as string
        const sdp = msg.sdp as string
        const cm = getConnectionManager()
        cm.handleSignalingOffer(from, sdp, (signal) => this.sendSignal(signal))
          .catch((err) => console.error('[SignalingClient] Error handling offer:', err))
        break
      }

      case 'answer': {
        const from = msg.from as string
        const sdp = msg.sdp as string
        getConnectionManager().handleSignalingAnswer(from, sdp)
          .catch((err) => console.error('[SignalingClient] Error handling answer:', err))
        break
      }

      case 'ice-candidate': {
        const from = msg.from as string
        const candidate = msg.candidate as RTCIceCandidateInit
        getConnectionManager().handleSignalingIceCandidate(from, candidate)
          .catch((err) => console.error('[SignalingClient] Error handling ICE:', err))
        break
      }

      case 'peer-joined': {
        const peerId = msg.peerId as string
        const displayName = msg.displayName as string
        usePeerStore.getState().upsertPeer({
          id: peerId,
          displayName,
          publicKey: '',
          capabilities: [],
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        })
        this.emit('peer-joined', peerId, displayName)
        break
      }

      case 'peer-left': {
        const peerId = msg.peerId as string
        usePeerStore.getState().removePeer(peerId)
        this.emit('peer-left', peerId)
        break
      }

      case 'ping':
        this.send({ type: 'pong' })
        break

      case 'error':
        console.error('[SignalingClient] Server error:', msg.code, msg.message)
        toast.error(`Signaling error: ${msg.message}`)
        break
    }
  }

  private setState(state: SignalingState): void {
    this.state = state
    this.emit('state-change', state)
  }

  private scheduleReconnect(): void {
    if (this._destroyed || this.reconnectAttempts >= this.maxReconnectAttempts) return

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(() => {
      if (!this._destroyed) {
        this.connect(this.url)
      }
    }, delay)
  }

  connectToPeer(peerId: string): void {
    const cm = getConnectionManager()
    cm.connectViaSignaling(peerId, (signal) => this.sendSignal(signal))
      .catch((err) => {
        console.error('[SignalingClient] Connect error:', err)
        toast.error('Failed to connect to peer')
      })
  }
}

// Singleton
let signalingInstance: SignalingClient | null = null

export function getSignalingClient(): SignalingClient {
  if (!signalingInstance) {
    signalingInstance = new SignalingClient()
  }
  return signalingInstance
}
