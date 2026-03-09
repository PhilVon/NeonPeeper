import WebSocket from 'ws'
import type { CommunityConfig } from './config'

export class SignalingBridge {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private destroyed = false

  constructor(private config: CommunityConfig) {}

  connect(): void {
    if (this.destroyed) return

    console.log(`[SignalingBridge] Connecting to ${this.config.signalingUrl}...`)

    try {
      this.ws = new WebSocket(this.config.signalingUrl)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.on('open', () => {
      this.reconnectAttempts = 0
      console.log('[SignalingBridge] Connected to signaling server')

      // Register as a community server
      this.send({
        type: 'register',
        peerId: this.config.serverId,
        displayName: this.config.serverName,
        peerType: 'community-server',
        capabilities: ['community-server'],
        wsUrl: `ws://localhost:${this.config.port}`,
      })
    })

    this.ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      const type = msg.type as string
      switch (type) {
        case 'registered':
          console.log(`[SignalingBridge] Registered as ${msg.peerId}`)
          break
        case 'ping':
          this.send({ type: 'pong' })
          break
        case 'error':
          console.error(`[SignalingBridge] Error: ${msg.message}`)
          break
      }
    })

    this.ws.on('close', () => {
      console.log('[SignalingBridge] Disconnected from signaling server')
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      console.error('[SignalingBridge] WebSocket error:', err.message)
    })
  }

  disconnect(): void {
    this.destroyed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectAttempts >= this.maxReconnectAttempts) return

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    console.log(`[SignalingBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`)

    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) {
        this.connect()
      }
    }, delay)
  }
}
