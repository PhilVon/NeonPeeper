import { useState } from 'react'
import { Avatar } from '../ui/Avatar'
import { StatusIndicator } from '../ui/StatusIndicator'
import { NeonButton } from '../ui/NeonButton'
import { PeerVerifyDialog } from './PeerVerifyDialog'
import { useConnectionStore } from '../../store/connection-store'
import { getCryptoManager } from '../../services/CryptoManager'
import type { PeerProfile } from '../../types/peer'
import './PeerCard.css'

interface PeerCardProps {
  peer: PeerProfile
  onChat?: (peerId: string) => void
  onConnect?: (peerId: string) => void
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function PeerCard({ peer, onChat, onConnect }: PeerCardProps) {
  const connection = useConnectionStore((s) => s.connections.get(peer.id))
  const isConnected = connection?.connectionState === 'connected'
  const isConnecting = connection?.connectionState === 'connecting' || connection?.connectionState === 'signaling'
  const [showVerify, setShowVerify] = useState(false)

  const isVerified = getCryptoManager().isVerified(peer.id)

  const status: 'online' | 'offline' | 'busy' | 'idle' = isConnected
    ? (peer.status ?? 'online')
    : isConnecting
    ? 'busy'
    : 'offline'

  return (
    <div className="peer-card" role="article" aria-label={`${peer.displayName}, ${status}`} tabIndex={0}>
      <div className="peer-card-header">
        <Avatar name={peer.displayName} src={peer.avatarDataUrl} size="medium" status={status} />
        <div className="peer-card-info">
          <span className="peer-card-name">
            {peer.displayName}
            {isVerified && <span className="peer-card-verified" title="Verified">&#10003;</span>}
          </span>
          <span className="peer-card-id">{peer.id.slice(0, 16)}...</span>
        </div>
        <StatusIndicator status={status} size="small" label={status} />
      </div>
      <div className="peer-card-meta">
        <span className="peer-card-meta-item">
          First seen: {formatTime(peer.firstSeen)}
        </span>
        <span className="peer-card-meta-item">
          Last seen: {formatTime(peer.lastSeen)}
        </span>
      </div>
      <div className="peer-card-actions">
        {isConnected ? (
          <>
            <NeonButton size="small" onClick={() => onChat?.(peer.id)}>
              Chat
            </NeonButton>
            <NeonButton size="small" variant="secondary" onClick={() => setShowVerify(true)}>
              Verify
            </NeonButton>
          </>
        ) : (
          <NeonButton
            size="small"
            variant="secondary"
            onClick={() => onConnect?.(peer.id)}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </NeonButton>
        )}
      </div>
      <PeerVerifyDialog
        peerId={peer.id}
        isOpen={showVerify}
        onClose={() => setShowVerify(false)}
      />
    </div>
  )
}
