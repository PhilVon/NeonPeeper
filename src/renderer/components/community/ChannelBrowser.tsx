import { Modal } from '../ui/Modal'
import { NeonButton } from '../ui/NeonButton'
import { useCommunityStore } from '../../store/community-store'
import { getCommunityClient } from '../../services/CommunityClient'
import './ChannelBrowser.css'

interface ChannelBrowserProps {
  isOpen: boolean
  onClose: () => void
  serverId: string
  onChannelJoined: (serverId: string, channelId: string) => void
}

export function ChannelBrowser({ isOpen, onClose, serverId, onChannelJoined }: ChannelBrowserProps) {
  const server = useCommunityStore((s) => s.servers.get(serverId))
  const channels = useCommunityStore((s) => s.channels.get(serverId) || [])

  const handleJoin = (channelId: string) => {
    getCommunityClient().joinChannel(serverId, channelId)
    onChannelJoined(serverId, channelId)
  }

  const handleLeave = (channelId: string) => {
    getCommunityClient().leaveChannel(serverId, channelId)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${server?.serverName || 'Community'} — Channels`}>
      <div className="channel-browser-header">
        <h3>{server?.serverName || 'Community Server'}</h3>
      </div>
      <div className="channel-browser-list">
        {channels.length === 0 && (
          <div className="channel-browser-empty">
            <p>No channels available.</p>
          </div>
        )}
        {channels.map((channel) => (
          <div key={channel.id} className="channel-browser-item">
            <div className="channel-browser-item-info">
              <span className="channel-browser-item-name">#{channel.name}</span>
              {channel.description && (
                <span className="channel-browser-item-description">{channel.description}</span>
              )}
              {channel.topic && (
                <span className="channel-browser-item-topic">{channel.topic}</span>
              )}
            </div>
            <span className="channel-browser-item-meta">{channel.memberCount} members</span>
            {channel.joined ? (
              <NeonButton size="small" variant="danger" onClick={() => handleLeave(channel.id)}>
                Leave
              </NeonButton>
            ) : (
              <NeonButton size="small" onClick={() => handleJoin(channel.id)}>
                Join
              </NeonButton>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
