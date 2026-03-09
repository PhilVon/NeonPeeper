import { NeonButton } from '../ui/NeonButton'
import type { CommunityServerInfo } from '../../store/community-store'
import { getCommunityClient } from '../../services/CommunityClient'
import './CommunityServerCard.css'

interface CommunityServerCardProps {
  server: CommunityServerInfo
  wsUrl: string
  onBrowseChannels: (serverId: string) => void
}

export function CommunityServerCard({ server, wsUrl, onBrowseChannels }: CommunityServerCardProps) {
  const connected = server.connected

  const handleConnect = () => {
    getCommunityClient().connect(server.serverId, wsUrl)
  }

  const handleDisconnect = () => {
    getCommunityClient().disconnect(server.serverId)
  }

  const handleBrowse = () => {
    if (connected) {
      getCommunityClient().requestChannelList(server.serverId)
    }
    onBrowseChannels(server.serverId)
  }

  return (
    <div className="community-server-card">
      <div className="community-server-card-header">
        <div className="community-server-card-icon">
          {server.iconDataUrl ? (
            <img src={server.iconDataUrl} alt={server.serverName} />
          ) : (
            '#'
          )}
        </div>
        <div className="community-server-card-info">
          <span className="community-server-card-name">{server.serverName}</span>
        </div>
        <div
          className={[
            'community-server-card-status',
            connected ? 'community-server-card-status-connected' : 'community-server-card-status-disconnected',
          ].join(' ')}
          title={connected ? 'Connected' : 'Disconnected'}
        />
      </div>
      {server.description && (
        <div className="community-server-card-description">{server.description}</div>
      )}
      <div className="community-server-card-meta">
        <span>{server.channelCount} channels</span>
        <span>{server.memberCount} members</span>
      </div>
      <div className="community-server-card-actions">
        {connected ? (
          <>
            <NeonButton size="small" onClick={handleBrowse}>
              Browse Channels
            </NeonButton>
            <NeonButton size="small" variant="danger" onClick={handleDisconnect}>
              Disconnect
            </NeonButton>
          </>
        ) : (
          <NeonButton size="small" variant="secondary" onClick={handleConnect}>
            Connect
          </NeonButton>
        )}
      </div>
    </div>
  )
}
