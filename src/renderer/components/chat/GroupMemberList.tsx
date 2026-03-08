import { usePeerStore } from '../../store/peer-store'
import { useConnectionStore } from '../../store/connection-store'
import { Avatar } from '../ui/Avatar'
import { NeonButton } from '../ui/NeonButton'
import './GroupMemberList.css'

interface GroupMemberListProps {
  members: string[]
  onInvite?: () => void
  onRemove?: (peerId: string) => void
}

export function GroupMemberList({ members, onInvite, onRemove }: GroupMemberListProps) {
  const peers = usePeerStore((s) => s.peers)
  const connections = useConnectionStore((s) => s.connections)
  const localId = usePeerStore.getState().localProfile?.id

  return (
    <div className="group-member-list">
      <div className="group-member-list-header">
        <span className="group-member-list-title">Members ({members.length})</span>
        {onInvite && (
          <NeonButton size="small" variant="secondary" onClick={onInvite}>
            Invite
          </NeonButton>
        )}
      </div>
      <div className="group-member-list-items">
        {members.map((memberId) => {
          const peer = peers.get(memberId)
          const isLocal = memberId === localId
          const conn = connections.get(memberId)
          const cs = conn?.connectionState
          const status: 'online' | 'offline' = isLocal || cs === 'connected' || cs === 'verified'
            ? 'online'
            : 'offline'

          return (
            <div key={memberId} className="group-member-item">
              <Avatar
                name={isLocal ? 'You' : peer?.displayName || memberId.slice(0, 8)}
                size="small"
                status={status}
              />
              <span className="group-member-name">
                {isLocal ? 'You' : peer?.displayName || memberId.slice(0, 8) + '...'}
              </span>
              {!isLocal && onRemove && (
                <button
                  className="group-member-remove"
                  onClick={() => onRemove(memberId)}
                  title="Remove member"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
