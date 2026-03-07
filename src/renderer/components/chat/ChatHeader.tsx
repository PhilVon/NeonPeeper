import { usePeerStore } from '../../store/peer-store'
import { useConnectionStore } from '../../store/connection-store'
import { StatusIndicator } from '../ui/StatusIndicator'
import { NeonButton } from '../ui/NeonButton'
import type { Chat } from '../../types/chat'
import './ChatHeader.css'

interface ChatHeaderProps {
  chat: Chat
  onToggleVideo?: () => void
  onToggleAudio?: () => void
  isVideoActive?: boolean
}

export function ChatHeader({ chat, onToggleVideo, onToggleAudio, isVideoActive = false }: ChatHeaderProps) {
  const peers = usePeerStore((s) => s.peers)
  const connections = useConnectionStore((s) => s.connections)
  const localId = usePeerStore.getState().localProfile?.id

  const getDisplayName = (): string => {
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
    if (chat.type === 'group') return 'online'
    const otherMember = chat.members.find((m) => m !== localId)
    if (!otherMember) return 'offline'
    const conn = connections.get(otherMember)
    return conn?.connectionState === 'connected' ? 'online' : 'offline'
  }

  const isOnline = getStatus() === 'online'
  const memberCount = chat.type === 'group' ? chat.members.length : undefined

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
    </div>
  )
}
