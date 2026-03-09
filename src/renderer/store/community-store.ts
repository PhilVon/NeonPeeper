import { create } from 'zustand'

export interface CommunityServerInfo {
  serverId: string
  serverName: string
  description: string
  iconDataUrl?: string
  channelCount: number
  memberCount: number
  ownerId: string
  connected: boolean
}

export interface CommunityChannel {
  id: string
  name: string
  description: string
  memberCount: number
  topic?: string
  joined: boolean
}

export interface CommunityChannelMember {
  peerId: string
  displayName: string
  role: 'owner' | 'member'
  joinedAt: number
}

interface CommunityState {
  servers: Map<string, CommunityServerInfo>
  channels: Map<string, CommunityChannel[]>
  members: Map<string, CommunityChannelMember[]> // keyed by chatId (community:serverId:channelId)
  browsingServerId: string | null

  upsertServer: (info: CommunityServerInfo) => void
  removeServer: (serverId: string) => void
  setServerConnected: (serverId: string, connected: boolean) => void
  setChannels: (serverId: string, channels: CommunityChannel[]) => void
  updateChannelJoined: (serverId: string, channelId: string, joined: boolean) => void
  setMembers: (chatId: string, members: CommunityChannelMember[]) => void
  setBrowsingServer: (serverId: string | null) => void
}

export const useCommunityStore = create<CommunityState>((set) => ({
  servers: new Map(),
  channels: new Map(),
  members: new Map(),
  browsingServerId: null,

  upsertServer: (info) =>
    set((state) => {
      const servers = new Map(state.servers)
      servers.set(info.serverId, info)
      return { servers }
    }),

  removeServer: (serverId) =>
    set((state) => {
      const servers = new Map(state.servers)
      servers.delete(serverId)
      const channels = new Map(state.channels)
      channels.delete(serverId)
      return { servers, channels }
    }),

  setServerConnected: (serverId, connected) =>
    set((state) => {
      const servers = new Map(state.servers)
      const existing = servers.get(serverId)
      if (existing) {
        servers.set(serverId, { ...existing, connected })
      }
      return { servers }
    }),

  setChannels: (serverId, channels) =>
    set((state) => {
      const channelsMap = new Map(state.channels)
      channelsMap.set(serverId, channels)
      return { channels: channelsMap }
    }),

  updateChannelJoined: (serverId, channelId, joined) =>
    set((state) => {
      const channelsMap = new Map(state.channels)
      const serverChannels = channelsMap.get(serverId)
      if (serverChannels) {
        channelsMap.set(
          serverId,
          serverChannels.map((ch) => (ch.id === channelId ? { ...ch, joined } : ch))
        )
      }
      return { channels: channelsMap }
    }),

  setMembers: (chatId, members) =>
    set((state) => {
      const membersMap = new Map(state.members)
      membersMap.set(chatId, members)
      return { members: membersMap }
    }),

  setBrowsingServer: (serverId) => set({ browsingServerId: serverId }),
}))
