import { NeonButton } from '../ui/NeonButton'
import { useCommunityStore, type CommunityChannelMember } from '../../store/community-store'
import { getCommunityClient } from '../../services/CommunityClient'
import { usePeerStore } from '../../store/peer-store'
import './ChannelMemberList.css'

interface ChannelMemberListProps {
  chatId: string
  serverId: string
  channelId: string
  isOwner: boolean
}

export function ChannelMemberList({ chatId, serverId, channelId, isOwner }: ChannelMemberListProps) {
  const members = useCommunityStore((s) => s.members.get(chatId) || [])
  const localId = usePeerStore.getState().localProfile?.id

  const handleBan = (member: CommunityChannelMember) => {
    if (!confirm(`Ban ${member.displayName} from this channel?`)) return
    getCommunityClient().banUser(serverId, channelId, member.peerId)
  }

  return (
    <div className="channel-member-list">
      {members.map((member) => (
        <div key={member.peerId} className="channel-member-item">
          <span className="channel-member-name">{member.displayName}</span>
          {member.role === 'owner' && (
            <span className="channel-member-role">Owner</span>
          )}
          {isOwner && member.peerId !== localId && member.role !== 'owner' && (
            <div className="channel-member-actions">
              <NeonButton size="small" variant="danger" onClick={() => handleBan(member)}>
                Ban
              </NeonButton>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
