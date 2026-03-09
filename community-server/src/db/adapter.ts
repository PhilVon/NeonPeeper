import type { Channel, StoredMessage, ChannelMember, Ban } from '../types'

export interface DatabaseAdapter {
  init(): Promise<void>
  close(): Promise<void>

  // Channels
  createChannel(channel: Channel): Promise<void>
  getChannels(): Promise<Channel[]>
  getChannel(id: string): Promise<Channel | null>
  updateChannel(id: string, updates: Partial<Pick<Channel, 'name' | 'description' | 'topic'>>): Promise<void>

  // Messages
  storeMessage(message: StoredMessage): Promise<void>
  getMessages(channelId: string, before?: number, limit?: number): Promise<StoredMessage[]>
  editMessage(id: string, content: string, editedAt: number, originalContent: string): Promise<void>
  deleteMessage(id: string): Promise<void>

  // Members
  addMember(member: ChannelMember): Promise<void>
  removeMember(channelId: string, peerId: string): Promise<void>
  getMembers(channelId: string): Promise<ChannelMember[]>
  isMember(channelId: string, peerId: string): Promise<boolean>
  getMemberCount(channelId: string): Promise<number>

  // Bans
  banUser(ban: Ban): Promise<void>
  unbanUser(peerId: string, channelId: string): Promise<void>
  isBanned(peerId: string, channelId: string): Promise<boolean>
}
