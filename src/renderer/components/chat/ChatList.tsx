import { useChatStore } from '../../store/chat-store'
import { usePeerStore } from '../../store/peer-store'
import { useConnectionStore } from '../../store/connection-store'
import { useArrowNavigation } from '../../hooks/useArrowNavigation'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import type { Chat } from '../../types/chat'
import './ChatList.css'

interface ChatListProps {
  onNewChat?: () => void
}

export function ChatList({ onNewChat }: ChatListProps) {
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const peers = usePeerStore((s) => s.peers)
  const connections = useConnectionStore((s) => s.connections)
  const { containerRef, handleKeyDown } = useArrowNavigation({ selector: '.chat-list-item' })

  const sortedChats = Array.from(chats.values()).sort(
    (a, b) => b.lastActivity - a.lastActivity
  )

  const getChatDisplayName = (chat: Chat): string => {
    if (chat.type === 'community' && chat.name) return chat.name
    if (chat.name) return chat.name
    if (chat.type === 'direct') {
      const localId = usePeerStore.getState().localProfile?.id
      const otherMember = chat.members.find((m) => m !== localId)
      if (otherMember) {
        return peers.get(otherMember)?.displayName ?? otherMember.slice(0, 8) + '...'
      }
    }
    if (chat.type === 'group') {
      const localId = usePeerStore.getState().localProfile?.id
      const otherMembers = chat.members.filter((m) => m !== localId)
      const names = otherMembers.map((m) =>
        peers.get(m)?.displayName ?? m.slice(0, 8) + '...'
      )
      return names.join(', ') || 'Empty Group'
    }
    return 'Unknown Chat'
  }

  const getChatAvatar = (chat: Chat): string | undefined => {
    if (chat.type === 'direct') {
      const localId = usePeerStore.getState().localProfile?.id
      const otherMember = chat.members.find((m) => m !== localId)
      if (otherMember) {
        return peers.get(otherMember)?.avatarDataUrl
      }
    }
    return undefined
  }

  const getPeerStatus = (chat: Chat): 'online' | 'offline' | 'busy' | 'idle' => {
    if (chat.type === 'community') return 'online'
    if (chat.type === 'group') return 'online'
    const localId = usePeerStore.getState().localProfile?.id
    const otherMember = chat.members.find((m) => m !== localId)
    if (!otherMember) return 'offline'
    const conn = connections.get(otherMember)
    const cs = conn?.connectionState
    return (cs === 'connected' || cs === 'verified') ? 'online' : 'offline'
  }

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <span className="chat-list-title">Conversations</span>
        {onNewChat && (
          <button className="chat-list-new" onClick={onNewChat} title="New Chat">+</button>
        )}
      </div>
      <div
        className="chat-list-items"
        role="listbox"
        aria-label="Conversations"
        ref={containerRef as React.RefObject<HTMLDivElement>}
        onKeyDown={handleKeyDown}
      >
        {sortedChats.length === 0 && (
          <p className="chat-list-empty">No conversations yet</p>
        )}
        {sortedChats.map((chat) => {
          const isActive = chat.id === activeChatId
          const displayName = getChatDisplayName(chat)
          const status = getPeerStatus(chat)

          return (
            <button
              key={chat.id}
              className={`chat-list-item ${isActive ? 'chat-list-item-active' : ''}`}
              onClick={() => setActiveChat(chat.id)}
              role="option"
              aria-selected={isActive}
            >
              <Avatar name={displayName} src={getChatAvatar(chat)} size="small" status={status} />
              <div className="chat-list-item-info">
                <span className="chat-list-item-name">{displayName}</span>
                {chat.lastMessagePreview && (
                  <span className="chat-list-item-preview">
                    {chat.lastMessagePreview}
                  </span>
                )}
              </div>
              {chat.unreadCount > 0 && (
                <Badge variant="info" size="small" glow>
                  {chat.unreadCount}
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
