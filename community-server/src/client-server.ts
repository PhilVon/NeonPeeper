import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import type { ConnectedClient } from './types'
import type { MessageHandler } from './message-handler'
import type { ChannelManager } from './channel-manager'
import type { CommunityConfig } from './config'
import type { MediaRelay } from './media-relay'

const PROTOCOL_VERSION = 'NEONP2P/1.0'
const MAX_MESSAGE_SIZE = 131_072

export class ClientServer {
  private wss: WebSocketServer | null = null

  constructor(
    private config: CommunityConfig,
    private messageHandler: MessageHandler,
    private channelManager: ChannelManager,
    private clients: Map<string, ConnectedClient>,
    private mediaRelay: MediaRelay
  ) {}

  start(): void {
    this.wss = new WebSocketServer({ port: this.config.port })

    console.log(`[ClientServer] Listening on ws://localhost:${this.config.port}`)

    this.wss.on('connection', (ws) => {
      let clientPeerId: string | null = null

      ws.on('message', (raw) => {
        const rawStr = raw.toString()
        if (rawStr.length > MAX_MESSAGE_SIZE) return

        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(rawStr)
        } catch {
          return
        }

        const type = msg.type as string

        // First message must be HELLO (handshake)
        if (!clientPeerId) {
          if (type === 'HELLO') {
            const payload = msg.payload as { displayName: string } | undefined
            clientPeerId = msg.from as string
            if (!clientPeerId) {
              ws.close()
              return
            }
            const displayName = payload?.displayName || 'Anonymous'

            const client: ConnectedClient = {
              ws,
              peerId: clientPeerId,
              displayName,
              channels: new Set(),
            }
            this.clients.set(clientPeerId, client)

            console.log(`[ClientServer] Client connected: ${clientPeerId} (${displayName})`)

            // Respond with COMMUNITY_INFO
            this.send(ws, {
              version: PROTOCOL_VERSION,
              type: 'COMMUNITY_INFO',
              id: uuidv4(),
              from: this.config.serverId,
              to: clientPeerId,
              chatId: null,
              timestamp: Date.now(),
              payload: {
                serverId: this.config.serverId,
                serverName: this.config.serverName,
                description: this.config.serverDescription,
                channelCount: 0, // Will be updated below
                memberCount: this.clients.size,
                ownerId: this.config.ownerId,
              },
            })

            // Send updated channel count asynchronously
            this.channelManager.getChannels().then((channels) => {
              // The channel count was already sent; client will get updated on CHANNEL_LIST request
            }).catch(() => {})
          } else {
            // Not authenticated yet, close
            ws.close()
          }
          return
        }

        // Authenticated — route to message handler
        const client = this.clients.get(clientPeerId)
        if (!client) return

        this.messageHandler
          .handle(client, msg as {
            version: string
            type: string
            id: string
            from: string
            to: string
            chatId: string | null
            timestamp: number
            payload: Record<string, unknown>
          })
          .catch((err) => {
            console.error(`[ClientServer] Error handling message from ${clientPeerId}:`, err)
          })
      })

      ws.on('close', () => {
        if (clientPeerId) {
          const client = this.clients.get(clientPeerId)
          if (client) {
            // Leave all voice sessions and notify
            const leftVoiceChannels = this.mediaRelay.leaveAllSessions(clientPeerId)
            for (const channelId of leftVoiceChannels) {
              for (const [, otherClient] of this.clients) {
                if (otherClient.peerId !== clientPeerId && otherClient.channels.has(channelId)) {
                  this.send(otherClient.ws, {
                    version: PROTOCOL_VERSION,
                    type: 'MEDIA_STOP',
                    id: uuidv4(),
                    from: clientPeerId,
                    to: '',
                    chatId: `community:${this.config.serverId}:${channelId}`,
                    timestamp: Date.now(),
                    payload: { mediaType: 'camera', trackId: '' },
                  })
                }
              }
            }

            // Leave all channels
            for (const channelId of client.channels) {
              this.channelManager.leaveChannel(channelId, clientPeerId).catch(() => {})

              // Notify remaining members
              for (const [, otherClient] of this.clients) {
                if (otherClient.peerId !== clientPeerId && otherClient.channels.has(channelId)) {
                  this.send(otherClient.ws, {
                    version: PROTOCOL_VERSION,
                    type: 'CHANNEL_LEAVE',
                    id: uuidv4(),
                    from: this.config.serverId,
                    to: '',
                    chatId: `community:${this.config.serverId}:${channelId}`,
                    timestamp: Date.now(),
                    payload: { channelId, peerId: clientPeerId },
                  })
                }
              }
            }
          }
          this.clients.delete(clientPeerId)
          console.log(`[ClientServer] Client disconnected: ${clientPeerId}`)
        }
      })

      ws.on('error', (err) => {
        console.error('[ClientServer] WebSocket error:', err.message)
      })
    })
  }

  stop(): void {
    for (const [, client] of this.clients) {
      client.ws.close()
    }
    this.clients.clear()
    this.wss?.close()
    this.wss = null
  }

  private send(ws: WebSocket, data: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }
}
