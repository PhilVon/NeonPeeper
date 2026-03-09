import { v4 as uuidv4 } from 'uuid'
import type { DatabaseAdapter } from './db/adapter'
import type { Channel, ChannelMember } from './types'

export class ChannelManager {
  constructor(private db: DatabaseAdapter) {}

  async createChannel(name: string, description: string = ''): Promise<Channel> {
    const channel: Channel = {
      id: uuidv4(),
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await this.db.createChannel(channel)
    return channel
  }

  async ensureDefaultChannels(names: string[]): Promise<void> {
    const existing = await this.db.getChannels()
    const existingNames = new Set(existing.map((c) => c.name))
    for (const name of names) {
      if (!existingNames.has(name)) {
        await this.createChannel(name, `The ${name} channel`)
        console.log(`[ChannelManager] Created default channel: #${name}`)
      }
    }
  }

  async getChannels(): Promise<Channel[]> {
    return this.db.getChannels()
  }

  async getChannel(id: string): Promise<Channel | null> {
    return this.db.getChannel(id)
  }

  async joinChannel(channelId: string, peerId: string, displayName: string, role: 'owner' | 'member' = 'member'): Promise<ChannelMember> {
    const member: ChannelMember = {
      channelId,
      peerId,
      displayName,
      role,
      joinedAt: Date.now(),
    }
    await this.db.addMember(member)
    return member
  }

  async leaveChannel(channelId: string, peerId: string): Promise<void> {
    await this.db.removeMember(channelId, peerId)
  }

  async getMembers(channelId: string): Promise<ChannelMember[]> {
    return this.db.getMembers(channelId)
  }

  async isMember(channelId: string, peerId: string): Promise<boolean> {
    return this.db.isMember(channelId, peerId)
  }

  async getMemberCount(channelId: string): Promise<number> {
    return this.db.getMemberCount(channelId)
  }
}
