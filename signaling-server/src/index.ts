import { WebSocketServer, WebSocket } from 'ws'
import * as mediasoup from 'mediasoup'
import { SFURoom, createRoom } from './sfu-room'
import type { SFUMessage } from './types'

const args = process.argv.slice(2)
let portArg: string | undefined

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' || args[i] === '-p') {
    portArg = args[i + 1]
    break
  } else if (args[i].startsWith('--port=')) {
    portArg = args[i].split('=')[1]
    break
  }
}

const PORT = parseInt(portArg || process.env.PORT || '8080', 10)

// --- Validation constants ---
const MAX_PEER_ID_LENGTH = 64
const MAX_DISPLAY_NAME_LENGTH = 100
const MAX_ROOM_ID_LENGTH = 128
const MAX_SDP_SIZE = 65_536  // 64KB max for SDP
const MAX_MESSAGE_SIZE = 131_072  // 128KB max for any message
const RATE_LIMIT_WINDOW_MS = 10_000
const RATE_LIMIT_MAX_MESSAGES = 50

interface PeerInfo {
  ws: WebSocket
  peerId: string
  displayName: string
  rooms: Set<string>
  lastPong: number
  messageTimestamps: number[]  // for rate limiting
  peerType?: string
  capabilities?: string[]
  wsUrl?: string
}

const peers = new Map<string, PeerInfo>()
const rooms = new Map<string, Set<string>>() // roomId -> Set<peerId>

// --- SFU state ---
const sfuRooms = new Map<string, SFURoom>()
let mediasoupWorker: mediasoup.types.Worker | null = null

async function initMediasoup(): Promise<void> {
  try {
    mediasoupWorker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    })
    mediasoupWorker.on('died', () => {
      console.error('[Signaling] mediasoup Worker died, restarting...')
      initMediasoup().catch((err) => console.error('[Signaling] Worker restart failed:', err))
    })
    console.log('[Signaling] mediasoup Worker created')
  } catch (err) {
    console.error('[Signaling] Failed to create mediasoup Worker:', err)
    console.log('[Signaling] SFU features will be unavailable. Install build tools if needed.')
    mediasoupWorker = null
  }
}

function sendToPeerCallback(peerId: string, data: Record<string, unknown>): void {
  const peer = peers.get(peerId)
  if (peer) {
    send(peer.ws, data)
  }
}

async function getOrCreateSFURoom(roomId: string): Promise<SFURoom> {
  let room = sfuRooms.get(roomId)
  if (!room) {
    if (!mediasoupWorker) throw new Error('mediasoup Worker not available')
    room = await createRoom(mediasoupWorker, roomId, sendToPeerCallback)
    sfuRooms.set(roomId, room)
  }
  return room
}

function cleanupSFUPeer(peerId: string): void {
  for (const [roomId, room] of sfuRooms) {
    if (room.hasPeer(peerId)) {
      room.removePeer(peerId)
      if (room.getPeerCount() === 0) {
        room.close()
        sfuRooms.delete(roomId)
      }
    }
  }
}
// --- End SFU state ---

function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function getPeerByWs(ws: WebSocket): PeerInfo | undefined {
  for (const peer of peers.values()) {
    if (peer.ws === ws) return peer
  }
  return undefined
}

function removePeer(peerId: string): void {
  const peer = peers.get(peerId)
  if (!peer) return

  // Clean up SFU resources
  cleanupSFUPeer(peerId)

  // Leave all rooms
  for (const roomId of peer.rooms) {
    const room = rooms.get(roomId)
    if (room) {
      room.delete(peerId)
      // Notify room members
      for (const memberId of room) {
        const member = peers.get(memberId)
        if (member) {
          send(member.ws, { type: 'peer-left', roomId, peerId })
        }
      }
      if (room.size === 0) {
        rooms.delete(roomId)
      }
    }
  }

  peers.delete(peerId)

  // Notify all remaining peers about the disconnection
  for (const [, remainingPeer] of peers) {
    send(remainingPeer.ws, { type: 'peer-left', peerId })
  }

  console.log(`[Signaling] Peer disconnected: ${peerId} (${peer.displayName})`)
}

// --- SFU message handler ---
async function handleSFUMessage(ws: WebSocket, peer: PeerInfo, msg: Record<string, unknown>): Promise<void> {
  const type = msg.type as string
  const requestId = msg.requestId as string | undefined
  const data = (msg.data as Record<string, unknown>) || {}

  const respond = (responseData: Record<string, unknown>) => {
    send(ws, { type: `${type}-response`, requestId, data: responseData })
  }

  const respondError = (message: string) => {
    send(ws, { type: 'sfu-error', requestId, data: { message } })
  }

  try {
    switch (type) {
      case 'sfu-join': {
        const roomId = data.roomId as string
        if (!roomId) { respondError('Missing roomId'); return }
        if (!mediasoupWorker) { respondError('SFU not available'); return }

        const room = await getOrCreateSFURoom(roomId)
        room.addPeer(peer.peerId)
        respond({ routerRtpCapabilities: room.getRouterRtpCapabilities() })
        console.log(`[Signaling] Peer ${peer.peerId} joined SFU room ${roomId}`)
        break
      }

      case 'sfu-create-transport': {
        const roomId = data.roomId as string
        const direction = data.direction as 'send' | 'recv'
        const room = sfuRooms.get(roomId)
        if (!room) { respondError('Room not found'); return }

        const transportInfo = await room.createTransport(peer.peerId, direction)
        respond(transportInfo)
        break
      }

      case 'sfu-connect-transport': {
        const roomId = data.roomId as string
        const transportId = data.transportId as string
        const dtlsParameters = data.dtlsParameters as mediasoup.types.DtlsParameters
        const room = sfuRooms.get(roomId)
        if (!room) { respondError('Room not found'); return }

        await room.connectTransport(transportId, dtlsParameters)
        respond({})
        break
      }

      case 'sfu-produce': {
        const roomId = data.roomId as string
        const transportId = data.transportId as string
        const kind = data.kind as mediasoup.types.MediaKind
        const rtpParameters = data.rtpParameters as mediasoup.types.RtpParameters
        const room = sfuRooms.get(roomId)
        if (!room) { respondError('Room not found'); return }

        const producerId = await room.produce(peer.peerId, transportId, kind, rtpParameters)
        respond({ producerId })
        break
      }

      case 'sfu-consume': {
        const roomId = data.roomId as string
        const producerId = data.producerId as string
        const rtpCapabilities = data.rtpCapabilities as mediasoup.types.RtpCapabilities
        const room = sfuRooms.get(roomId)
        if (!room) { respondError('Room not found'); return }

        const consumerData = await room.consume(peer.peerId, producerId, rtpCapabilities)
        respond(consumerData)
        break
      }

      case 'sfu-resume-consumer': {
        const roomId = data.roomId as string
        const consumerId = data.consumerId as string
        const room = sfuRooms.get(roomId)
        if (!room) { respondError('Room not found'); return }

        await room.resumeConsumer(consumerId)
        respond({})
        break
      }

      case 'sfu-pause-consumer': {
        const roomId = data.roomId as string
        const consumerId = data.consumerId as string
        const room = sfuRooms.get(roomId)
        if (!room) { respondError('Room not found'); return }

        await room.pauseConsumer(consumerId)
        respond({})
        break
      }

      case 'sfu-set-preferred-layers': {
        const roomId = data.roomId as string
        const consumerId = data.consumerId as string
        const spatialLayer = data.spatialLayer as number
        const temporalLayer = data.temporalLayer as number | undefined
        const room = sfuRooms.get(roomId)
        if (!room) { respondError('Room not found'); return }

        await room.setPreferredLayers(consumerId, spatialLayer, temporalLayer)
        respond({})
        break
      }

      case 'sfu-close-producer': {
        const roomId = data.roomId as string
        const producerId = data.producerId as string
        const room = sfuRooms.get(roomId)
        if (!room) { respondError('Room not found'); return }

        room.removeProducer(producerId)
        respond({})
        break
      }

      case 'sfu-leave': {
        const roomId = data.roomId as string
        const room = sfuRooms.get(roomId)
        if (!room) { respond({}); return }

        room.removePeer(peer.peerId)
        if (room.getPeerCount() === 0) {
          room.close()
          sfuRooms.delete(roomId)
        }
        respond({})
        console.log(`[Signaling] Peer ${peer.peerId} left SFU room ${roomId}`)
        break
      }

      default:
        respondError(`Unknown SFU message type: ${type}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Signaling] SFU error (${type}):`, message)
    respondError(message)
  }
}

const wss = new WebSocketServer({ port: PORT })

console.log(`[Signaling] Server started on ws://localhost:${PORT}`)

// Initialize mediasoup (non-blocking)
initMediasoup().catch((err) => console.error('[Signaling] mediasoup init error:', err))

wss.on('connection', (ws) => {
  let registeredPeerId: string | null = null
  const connectionMessageTimestamps: number[] = []

  ws.on('message', (raw) => {
    // Message size check
    const rawStr = raw.toString()
    if (rawStr.length > MAX_MESSAGE_SIZE) {
      send(ws, { type: 'error', code: 2001, message: 'Message too large' })
      return
    }

    // Rate limiting (per-connection)
    const now = Date.now()
    while (connectionMessageTimestamps.length > 0 && now - connectionMessageTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
      connectionMessageTimestamps.shift()
    }
    if (connectionMessageTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
      send(ws, { type: 'error', code: 4029, message: 'Rate limit exceeded' })
      return
    }
    connectionMessageTimestamps.push(now)

    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(rawStr)
    } catch {
      send(ws, { type: 'error', code: 1000, message: 'Invalid JSON' })
      return
    }

    const type = msg.type as string

    // Route SFU messages
    if (type.startsWith('sfu-')) {
      const peer = getPeerByWs(ws)
      if (!peer) {
        send(ws, { type: 'sfu-error', requestId: msg.requestId, data: { message: 'Not registered' } })
        return
      }
      handleSFUMessage(ws, peer, msg).catch((err) => {
        console.error('[Signaling] SFU handler error:', err)
        send(ws, { type: 'sfu-error', requestId: msg.requestId, data: { message: 'Internal error' } })
      })
      return
    }

    switch (type) {
      case 'register': {
        const peerId = msg.peerId as string
        const rawDisplayName = (msg.displayName as string) || 'Anonymous'

        if (!peerId || typeof peerId !== 'string') {
          send(ws, { type: 'error', code: 1002, message: 'Missing peerId' })
          return
        }

        // Validate peerId format and length
        if (peerId.length > MAX_PEER_ID_LENGTH || !/^[a-zA-Z0-9_-]+$/.test(peerId)) {
          send(ws, { type: 'error', code: 1002, message: 'Invalid peerId format' })
          return
        }

        // Sanitize display name
        const displayName = rawDisplayName.slice(0, MAX_DISPLAY_NAME_LENGTH)

        // Remove old connection if exists
        if (peers.has(peerId)) {
          removePeer(peerId)
        }

        const peerType = msg.peerType as string | undefined
        const capabilities = msg.capabilities as string[] | undefined
        const wsUrl = msg.wsUrl as string | undefined

        registeredPeerId = peerId
        peers.set(peerId, {
          ws,
          peerId,
          displayName,
          rooms: new Set(),
          lastPong: Date.now(),
          messageTimestamps: [],
          peerType,
          capabilities,
          wsUrl,
        })

        send(ws, { type: 'registered', peerId })

        // Notify all existing peers about the new peer
        for (const [existingId, existingPeer] of peers) {
          if (existingId !== peerId) {
            send(existingPeer.ws, {
              type: 'peer-joined',
              peerId,
              displayName,
              ...(peerType && { peerType }),
              ...(capabilities && { capabilities }),
              ...(wsUrl && { wsUrl }),
            })
          }
        }

        console.log(`[Signaling] Peer registered: ${peerId} (${displayName})`)
        break
      }

      case 'discover': {
        const peer = getPeerByWs(ws)
        if (!peer) {
          send(ws, { type: 'error', code: 1000, message: 'Not registered' })
          return
        }

        const roomId = msg.roomId as string | undefined
        let peerList: Array<{ peerId: string; displayName: string; peerType?: string; capabilities?: string[]; wsUrl?: string }>

        if (roomId && rooms.has(roomId)) {
          const room = rooms.get(roomId)!
          peerList = Array.from(room)
            .filter((id) => id !== peer.peerId)
            .map((id) => {
              const p = peers.get(id)
              return {
                peerId: id,
                displayName: p?.displayName || 'Unknown',
                ...(p?.peerType && { peerType: p.peerType }),
                ...(p?.capabilities && { capabilities: p.capabilities }),
                ...(p?.wsUrl && { wsUrl: p.wsUrl }),
              }
            })
        } else {
          peerList = Array.from(peers.values())
            .filter((p) => p.peerId !== peer.peerId)
            .map((p) => ({
              peerId: p.peerId,
              displayName: p.displayName,
              ...(p.peerType && { peerType: p.peerType }),
              ...(p.capabilities && { capabilities: p.capabilities }),
              ...(p.wsUrl && { wsUrl: p.wsUrl }),
            }))
        }

        send(ws, { type: 'peer-list', peers: peerList })
        break
      }

      case 'offer': {
        const peer = getPeerByWs(ws)
        if (!peer) return

        const sdp = msg.sdp as string
        if (typeof sdp !== 'string' || sdp.length > MAX_SDP_SIZE) {
          send(ws, { type: 'error', code: 2001, message: 'Invalid or oversized SDP' })
          return
        }

        const to = msg.to as string
        if (typeof to !== 'string') return
        const target = peers.get(to)
        if (target) {
          send(target.ws, { type: 'offer', from: peer.peerId, sdp })
        } else {
          send(ws, { type: 'error', code: 1002, message: `Peer ${to} not found` })
        }
        break
      }

      case 'answer': {
        const peer = getPeerByWs(ws)
        if (!peer) return

        const sdp = msg.sdp as string
        if (typeof sdp !== 'string' || sdp.length > MAX_SDP_SIZE) {
          send(ws, { type: 'error', code: 2001, message: 'Invalid or oversized SDP' })
          return
        }

        const to = msg.to as string
        if (typeof to !== 'string') return
        const target = peers.get(to)
        if (target) {
          send(target.ws, { type: 'answer', from: peer.peerId, sdp })
        }
        break
      }

      case 'ice-candidate': {
        const peer = getPeerByWs(ws)
        if (!peer) return

        const to = msg.to as string
        const target = peers.get(to)
        if (target) {
          send(target.ws, {
            type: 'ice-candidate',
            from: peer.peerId,
            candidate: msg.candidate,
          })
        }
        break
      }

      case 'join-room': {
        const peer = getPeerByWs(ws)
        if (!peer) return

        const roomId = msg.roomId as string
        if (!roomId || typeof roomId !== 'string' || roomId.length > MAX_ROOM_ID_LENGTH) {
          send(ws, { type: 'error', code: 3000, message: 'Missing or invalid roomId' })
          return
        }

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set())
        }
        const room = rooms.get(roomId)!
        room.add(peer.peerId)
        peer.rooms.add(roomId)

        // Notify existing members
        for (const memberId of room) {
          if (memberId === peer.peerId) continue
          const member = peers.get(memberId)
          if (member) {
            send(member.ws, {
              type: 'peer-joined',
              roomId,
              peerId: peer.peerId,
              displayName: peer.displayName,
            })
          }
        }

        send(ws, { type: 'room-joined', roomId })
        break
      }

      case 'leave-room': {
        const peer = getPeerByWs(ws)
        if (!peer) return

        const roomId = msg.roomId as string
        const room = rooms.get(roomId)
        if (room) {
          room.delete(peer.peerId)
          peer.rooms.delete(roomId)

          for (const memberId of room) {
            const member = peers.get(memberId)
            if (member) {
              send(member.ws, { type: 'peer-left', roomId, peerId: peer.peerId })
            }
          }

          if (room.size === 0) {
            rooms.delete(roomId)
          }
        }
        break
      }

      case 'pong': {
        const peer = getPeerByWs(ws)
        if (peer) {
          peer.lastPong = Date.now()
        }
        break
      }

      default:
        send(ws, { type: 'error', code: 2003, message: `Unknown message type: ${type}` })
    }
  })

  ws.on('close', () => {
    if (registeredPeerId) {
      removePeer(registeredPeerId)
    }
  })

  ws.on('error', (err) => {
    console.error('[Signaling] WebSocket error:', err.message)
    if (registeredPeerId) {
      removePeer(registeredPeerId)
    }
  })
})

// Heartbeat: ping every 30s, timeout after 10s
const HEARTBEAT_INTERVAL = 30_000
const HEARTBEAT_TIMEOUT = 10_000

setInterval(() => {
  const now = Date.now()
  for (const [peerId, peer] of peers) {
    if (now - peer.lastPong > HEARTBEAT_INTERVAL + HEARTBEAT_TIMEOUT) {
      console.log(`[Signaling] Heartbeat timeout: ${peerId}`)
      peer.ws.terminate()
      removePeer(peerId)
    } else {
      send(peer.ws, { type: 'ping' })
    }
  }
}, HEARTBEAT_INTERVAL)

console.log(`[Signaling] Heartbeat: ${HEARTBEAT_INTERVAL}ms interval, ${HEARTBEAT_TIMEOUT}ms timeout`)
