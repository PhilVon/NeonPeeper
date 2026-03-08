import { WebSocketServer, WebSocket } from 'ws'

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

interface PeerInfo {
  ws: WebSocket
  peerId: string
  displayName: string
  rooms: Set<string>
  lastPong: number
}

const peers = new Map<string, PeerInfo>()
const rooms = new Map<string, Set<string>>() // roomId -> Set<peerId>

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

const wss = new WebSocketServer({ port: PORT })

console.log(`[Signaling] Server started on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  let registeredPeerId: string | null = null

  ws.on('message', (raw) => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      send(ws, { type: 'error', code: 1000, message: 'Invalid JSON' })
      return
    }

    const type = msg.type as string

    switch (type) {
      case 'register': {
        const peerId = msg.peerId as string
        const displayName = (msg.displayName as string) || 'Anonymous'

        if (!peerId) {
          send(ws, { type: 'error', code: 1002, message: 'Missing peerId' })
          return
        }

        // Remove old connection if exists
        if (peers.has(peerId)) {
          removePeer(peerId)
        }

        registeredPeerId = peerId
        peers.set(peerId, {
          ws,
          peerId,
          displayName,
          rooms: new Set(),
          lastPong: Date.now(),
        })

        send(ws, { type: 'registered', peerId })

        // Notify all existing peers about the new peer
        for (const [existingId, existingPeer] of peers) {
          if (existingId !== peerId) {
            send(existingPeer.ws, {
              type: 'peer-joined',
              peerId,
              displayName,
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
        let peerList: Array<{ peerId: string; displayName: string }>

        if (roomId && rooms.has(roomId)) {
          const room = rooms.get(roomId)!
          peerList = Array.from(room)
            .filter((id) => id !== peer.peerId)
            .map((id) => {
              const p = peers.get(id)
              return { peerId: id, displayName: p?.displayName || 'Unknown' }
            })
        } else {
          peerList = Array.from(peers.values())
            .filter((p) => p.peerId !== peer.peerId)
            .map((p) => ({ peerId: p.peerId, displayName: p.displayName }))
        }

        send(ws, { type: 'peer-list', peers: peerList })
        break
      }

      case 'offer': {
        const peer = getPeerByWs(ws)
        if (!peer) return

        const to = msg.to as string
        const target = peers.get(to)
        if (target) {
          send(target.ws, { type: 'offer', from: peer.peerId, sdp: msg.sdp })
        } else {
          send(ws, { type: 'error', code: 1002, message: `Peer ${to} not found` })
        }
        break
      }

      case 'answer': {
        const peer = getPeerByWs(ws)
        if (!peer) return

        const to = msg.to as string
        const target = peers.get(to)
        if (target) {
          send(target.ws, { type: 'answer', from: peer.peerId, sdp: msg.sdp })
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
        if (!roomId) {
          send(ws, { type: 'error', code: 3000, message: 'Missing roomId' })
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
