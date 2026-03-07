import { usePeerStore } from '../../store/peer-store'
import { PeerCard } from './PeerCard'
import { NeonButton } from '../ui/NeonButton'
import './PeerList.css'

interface PeerListProps {
  onChat: (peerId: string) => void
  onConnect: (peerId: string) => void
  onManualConnect: () => void
}

export function PeerList({ onChat, onConnect, onManualConnect }: PeerListProps) {
  const peers = usePeerStore((s) => s.peers)
  const localId = usePeerStore((s) => s.localProfile?.id)

  const peerList = Array.from(peers.values())
    .filter((p) => p.id !== localId)
    .sort((a, b) => b.lastSeen - a.lastSeen)

  return (
    <div className="peer-list">
      <div className="peer-list-header">
        <h2 className="text-cyan">Peers</h2>
        <NeonButton size="small" onClick={onManualConnect}>
          + Add Peer
        </NeonButton>
      </div>
      {peerList.length === 0 ? (
        <div className="peer-list-empty">
          <p className="text-muted">No peers discovered yet.</p>
          <p className="text-muted">Connect to a signaling server or add a peer manually.</p>
        </div>
      ) : (
        <div className="peer-list-grid">
          {peerList.map((peer) => (
            <PeerCard
              key={peer.id}
              peer={peer}
              onChat={onChat}
              onConnect={onConnect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
