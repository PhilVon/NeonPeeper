import { usePeerStore } from '../../store/peer-store'
import { useCommunityStore } from '../../store/community-store'
import { useArrowNavigation } from '../../hooks/useArrowNavigation'
import { PeerCard } from './PeerCard'
import { CommunityServerCard } from '../community/CommunityServerCard'
import { NeonButton } from '../ui/NeonButton'
import './PeerList.css'

interface PeerListProps {
  onChat: (peerId: string) => void
  onConnect: (peerId: string) => void
  onManualConnect: () => void
  onBrowseChannels: (serverId: string) => void
}

export function PeerList({ onChat, onConnect, onManualConnect, onBrowseChannels }: PeerListProps) {
  const peers = usePeerStore((s) => s.peers)
  const localId = usePeerStore((s) => s.localProfile?.id)
  const servers = useCommunityStore((s) => s.servers)
  const { containerRef, handleKeyDown } = useArrowNavigation({ selector: '.peer-card' })

  const allPeers = Array.from(peers.values()).filter((p) => p.id !== localId)
  const communityPeers = allPeers.filter((p) => p.peerType === 'community-server')
  const regularPeers = allPeers
    .filter((p) => p.peerType !== 'community-server')
    .sort((a, b) => b.lastSeen - a.lastSeen)

  return (
    <div className="peer-list" role="list" aria-label="Peer list">
      <div className="peer-list-header">
        <h2 className="text-cyan">Peers</h2>
        <NeonButton size="small" onClick={onManualConnect} aria-label="Add peer manually">
          + Add Peer
        </NeonButton>
      </div>

      {communityPeers.length > 0 && (
        <>
          <h3 className="text-magenta" style={{ margin: 'var(--spacing-sm) 0' }}>Community Servers</h3>
          <div className="peer-list-grid">
            {communityPeers.map((peer) => {
              const serverInfo = servers.get(peer.id)
              const info = serverInfo || {
                serverId: peer.id,
                serverName: peer.displayName,
                description: '',
                channelCount: 0,
                memberCount: 0,
                ownerId: '',
                connected: false,
              }
              return (
                <CommunityServerCard
                  key={peer.id}
                  server={info}
                  wsUrl={peer.wsUrl || ''}
                  onBrowseChannels={onBrowseChannels}
                />
              )
            })}
          </div>
        </>
      )}

      {communityPeers.length > 0 && regularPeers.length > 0 && (
        <h3 className="text-cyan" style={{ margin: 'var(--spacing-sm) 0' }}>Peers</h3>
      )}

      {regularPeers.length === 0 && communityPeers.length === 0 ? (
        <div className="peer-list-empty">
          <p className="text-muted">No peers discovered yet.</p>
          <p className="text-muted">Connect to a signaling server or add a peer manually.</p>
        </div>
      ) : (
        <div
          className="peer-list-grid"
          ref={containerRef as React.RefObject<HTMLDivElement>}
          onKeyDown={handleKeyDown}
        >
          {regularPeers.map((peer) => (
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
