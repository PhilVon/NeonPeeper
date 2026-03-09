import { useState } from 'react'
import { usePeerStore } from '../../store/peer-store'
import { useConnectionStore } from '../../store/connection-store'
import { useCommunityStore } from '../../store/community-store'
import { getCommunityClient } from '../../services/CommunityClient'
import { StatusIndicator } from '../ui/StatusIndicator'
import { NeonButton } from '../ui/NeonButton'
import { Modal } from '../ui/Modal'
import { ChannelMemberList } from '../community/ChannelMemberList'
import type { Chat } from '../../types/chat'
import './ChatHeader.css'

interface ChatHeaderProps {
  chat: Chat
  onToggleVideo?: () => void
  onToggleAudio?: () => void
  isVideoActive?: boolean
  isCommunity?: boolean
  communityServerId?: string
  communityChannelId?: string
}

export function ChatHeader({
  chat,
  onToggleVideo,
  onToggleAudio,
  isVideoActive = false,
  isCommunity = false,
  communityServerId = '',
  communityChannelId = '',
}: ChatHeaderProps) {
  const peers = usePeerStore((s) => s.peers)
  const connections = useConnectionStore((s) => s.connections)
  const localId = usePeerStore.getState().localProfile?.id
  const [showMembers, setShowMembers] = useState(false)

  const communityServer = useCommunityStore((s) => isCommunity ? s.servers.get(communityServerId) : undefined)
  const communityChannels = useCommunityStore((s) => isCommunity ? s.channels.get(communityServerId) : undefined)
  const communityChannel = communityChannels?.find((c) => c.id === communityChannelId)
  const members = useCommunityStore((s) => isCommunity ? s.members.get(chat.id) : undefined)
  const isOwner = isCommunity && localId === communityServer?.ownerId

  const getDisplayName = (): string => {
    if (isCommunity && communityChannel) {
      return `#${communityChannel.name}`
    }
    if (chat.name) return chat.name
    if (chat.type === 'direct') {
      const otherMember = chat.members.find((m) => m !== localId)
      if (otherMember) {
        return peers.get(otherMember)?.displayName ?? otherMember.slice(0, 8) + '...'
      }
    }
    return 'Unknown'
  }

  const getStatus = (): 'online' | 'offline' | 'busy' | 'idle' => {
    if (isCommunity) return getCommunityClient().isConnected(communityServerId) ? 'online' : 'offline'
    if (chat.type === 'group') return 'online'
    const otherMember = chat.members.find((m) => m !== localId)
    if (!otherMember) return 'offline'
    const conn = connections.get(otherMember)
    const cs = conn?.connectionState
    return (cs === 'connected' || cs === 'verified') ? 'online' : 'offline'
  }

  const isOnline = getStatus() === 'online'
  const memberCount = isCommunity
    ? (communityChannel?.memberCount ?? members?.length)
    : (chat.type === 'group' ? chat.members.length : undefined)

  const handleShowMembers = () => {
    getCommunityClient().requestMembers(communityServerId, communityChannelId)
    setShowMembers(true)
  }

  return (
    <div className="chat-header">
      <div className="chat-header-info">
        <StatusIndicator status={getStatus()} size="small" />
        <span className="chat-header-name">{getDisplayName()}</span>
        {memberCount != null && (
          <span className="chat-header-members">{memberCount} members</span>
        )}
      </div>
      <div className="chat-header-actions">
        {isCommunity && (
          <NeonButton size="small" variant="secondary" onClick={handleShowMembers}>
            Members
          </NeonButton>
        )}
        <NeonButton
          variant={isVideoActive ? 'danger' : 'secondary'}
          size="small"
          disabled={!isOnline}
          onClick={onToggleAudio}
          title={isVideoActive ? 'Leave call' : 'Voice call'}
        >
          {isVideoActive ? 'Leave' : 'Voice'}
        </NeonButton>
        <NeonButton
          variant={isVideoActive ? 'danger' : 'secondary'}
          size="small"
          disabled={!isOnline}
          onClick={onToggleVideo}
          title={isVideoActive ? 'Stop video' : 'Share video'}
        >
          {isVideoActive ? 'Stop Video' : 'Video'}
        </NeonButton>
      </div>
      {isCommunity && (
        <Modal isOpen={showMembers} onClose={() => setShowMembers(false)} title="Channel Members">
          <ChannelMemberList
            chatId={chat.id}
            serverId={communityServerId}
            channelId={communityChannelId}
            isOwner={isOwner}
          />
        </Modal>
      )}
    </div>
  )
}
