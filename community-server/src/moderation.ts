import type { DatabaseAdapter } from './db/adapter'
import type { Ban } from './types'

export class ModerationManager {
  constructor(
    private db: DatabaseAdapter,
    private ownerId: string
  ) {}

  async banUser(
    channelId: string,
    targetPeerId: string,
    requesterId: string,
    reason?: string
  ): Promise<boolean> {
    if (requesterId !== this.ownerId) {
      return false
    }
    const ban: Ban = {
      peerId: targetPeerId,
      channelId,
      reason,
      bannedAt: Date.now(),
      bannedBy: requesterId,
    }
    await this.db.banUser(ban)

    // Remove from channel membership
    if (channelId === '*') {
      // Server-wide ban: remove from all channels
      const channels = await this.db.getChannels()
      for (const ch of channels) {
        await this.db.removeMember(ch.id, targetPeerId)
      }
    } else {
      await this.db.removeMember(channelId, targetPeerId)
    }

    return true
  }

  async unbanUser(channelId: string, targetPeerId: string, requesterId: string): Promise<boolean> {
    if (requesterId !== this.ownerId) {
      return false
    }
    await this.db.unbanUser(targetPeerId, channelId)
    return true
  }

  async isAllowed(peerId: string, channelId: string): Promise<boolean> {
    return !(await this.db.isBanned(peerId, channelId))
  }
}
