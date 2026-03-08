import { create } from 'zustand'
import type { QualityPreset } from '../types/protocol'
import type { RemoteStream } from '../types/media'
import type { Topology } from '../services/SFUClient'

interface SFUConsumerState {
  peerId: string
  kind: string
  paused: boolean
}

interface MediaState {
  localCameraStream: MediaStream | null
  localScreenStream: MediaStream | null
  audioMuted: boolean
  videoEnabled: boolean
  remoteStreams: Map<string, RemoteStream>
  remoteScreenStreams: Map<string, RemoteStream>
  currentQuality: QualityPreset
  videoSharingChatIds: Set<string>
  chatVideoParticipants: Map<string, Set<string>>
  peerMediaTypes: Record<string, string[]>

  // SFU state
  topology: Topology
  sfuProducers: Map<string, string> // trackId -> producerId
  sfuConsumers: Map<string, SFUConsumerState> // consumerId -> info
  activeSpeakerPeerId: string | null

  setLocalCameraStream: (stream: MediaStream | null) => void
  setLocalScreenStream: (stream: MediaStream | null) => void
  setAudioMuted: (muted: boolean) => void
  setVideoEnabled: (enabled: boolean) => void
  addRemoteStream: (peerId: string, stream: MediaStream) => void
  removeRemoteStream: (peerId: string) => void
  addRemoteScreenStream: (peerId: string, stream: MediaStream) => void
  removeRemoteScreenStream: (peerId: string) => void
  setCurrentQuality: (quality: QualityPreset) => void
  startSharingInChat: (chatId: string) => void
  stopSharingInChat: (chatId: string) => void
  addChatVideoParticipant: (chatId: string, peerId: string) => void
  removeChatVideoParticipant: (chatId: string, peerId: string) => void
  addPeerMediaType: (peerId: string, mediaType: string) => void
  removePeerMediaType: (peerId: string, mediaType: string) => void
  clearPeerMediaTypes: (peerId: string) => void
  clearAllStreams: () => void

  // SFU actions
  setTopology: (topology: Topology) => void
  setSFUProducer: (trackId: string, producerId: string) => void
  removeSFUProducer: (trackId: string) => void
  addSFUConsumer: (consumerId: string, info: SFUConsumerState) => void
  removeSFUConsumer: (consumerId: string) => void
  setActiveSpeaker: (peerId: string | null) => void
  pauseSFUConsumer: (consumerId: string) => void
  resumeSFUConsumer: (consumerId: string) => void
}

export const useMediaStore = create<MediaState>((set) => ({
  localCameraStream: null,
  localScreenStream: null,
  audioMuted: false,
  videoEnabled: true,
  remoteStreams: new Map(),
  remoteScreenStreams: new Map(),
  currentQuality: 'high',
  videoSharingChatIds: new Set(),
  chatVideoParticipants: new Map(),
  peerMediaTypes: {},

  // SFU initial state
  topology: 'direct',
  sfuProducers: new Map(),
  sfuConsumers: new Map(),
  activeSpeakerPeerId: null,

  setLocalCameraStream: (stream) => set({ localCameraStream: stream }),
  setLocalScreenStream: (stream) => set({ localScreenStream: stream }),
  setAudioMuted: (muted) => set({ audioMuted: muted }),
  setVideoEnabled: (enabled) => set({ videoEnabled: enabled }),

  addRemoteStream: (peerId, stream) =>
    set((state) => {
      const remoteStreams = new Map(state.remoteStreams)
      remoteStreams.set(peerId, {
        peerId,
        stream,
        audioMuted: false,
        videoEnabled: true,
      })
      return { remoteStreams }
    }),

  removeRemoteStream: (peerId) =>
    set((state) => {
      const remoteStreams = new Map(state.remoteStreams)
      remoteStreams.delete(peerId)
      return { remoteStreams }
    }),

  addRemoteScreenStream: (peerId, stream) =>
    set((state) => {
      const remoteScreenStreams = new Map(state.remoteScreenStreams)
      remoteScreenStreams.set(peerId, {
        peerId,
        stream,
        audioMuted: true,
        videoEnabled: true,
      })
      return { remoteScreenStreams }
    }),

  removeRemoteScreenStream: (peerId) =>
    set((state) => {
      const remoteScreenStreams = new Map(state.remoteScreenStreams)
      remoteScreenStreams.delete(peerId)
      return { remoteScreenStreams }
    }),

  setCurrentQuality: (quality) => set({ currentQuality: quality }),

  startSharingInChat: (chatId) =>
    set((state) => {
      const videoSharingChatIds = new Set(state.videoSharingChatIds)
      videoSharingChatIds.add(chatId)
      return { videoSharingChatIds }
    }),

  stopSharingInChat: (chatId) =>
    set((state) => {
      const videoSharingChatIds = new Set(state.videoSharingChatIds)
      videoSharingChatIds.delete(chatId)
      return { videoSharingChatIds }
    }),

  addChatVideoParticipant: (chatId, peerId) =>
    set((state) => {
      const chatVideoParticipants = new Map(state.chatVideoParticipants)
      const participants = new Set<string>(chatVideoParticipants.get(chatId) ?? [])
      participants.add(peerId)
      chatVideoParticipants.set(chatId, participants)
      return { chatVideoParticipants }
    }),

  removeChatVideoParticipant: (chatId, peerId) =>
    set((state) => {
      const chatVideoParticipants = new Map(state.chatVideoParticipants)
      const participants = chatVideoParticipants.get(chatId)
      if (participants) {
        const updated = new Set(participants)
        updated.delete(peerId)
        if (updated.size === 0) {
          chatVideoParticipants.delete(chatId)
        } else {
          chatVideoParticipants.set(chatId, updated)
        }
      }
      return { chatVideoParticipants }
    }),

  addPeerMediaType: (peerId, mediaType) =>
    set((state) => {
      const existing = state.peerMediaTypes[peerId] ?? []
      if (existing.includes(mediaType)) return state
      return { peerMediaTypes: { ...state.peerMediaTypes, [peerId]: [...existing, mediaType] } }
    }),

  removePeerMediaType: (peerId, mediaType) =>
    set((state) => {
      const existing = state.peerMediaTypes[peerId]
      if (!existing) return state
      const filtered = existing.filter((t) => t !== mediaType)
      return { peerMediaTypes: { ...state.peerMediaTypes, [peerId]: filtered } }
    }),

  clearPeerMediaTypes: (peerId) =>
    set((state) => {
      const { [peerId]: _, ...rest } = state.peerMediaTypes
      return { peerMediaTypes: rest }
    }),

  clearAllStreams: () =>
    set((state) => {
      state.localCameraStream?.getTracks().forEach((t) => t.stop())
      state.localScreenStream?.getTracks().forEach((t) => t.stop())
      return {
        localCameraStream: null,
        localScreenStream: null,
        remoteStreams: new Map(),
        remoteScreenStreams: new Map(),
        videoSharingChatIds: new Set(),
        chatVideoParticipants: new Map(),
        peerMediaTypes: {},
        sfuProducers: new Map(),
        sfuConsumers: new Map(),
        activeSpeakerPeerId: null,
      }
    }),

  // SFU actions
  setTopology: (topology) => set({ topology }),

  setSFUProducer: (trackId, producerId) =>
    set((state) => {
      const sfuProducers = new Map(state.sfuProducers)
      sfuProducers.set(trackId, producerId)
      return { sfuProducers }
    }),

  removeSFUProducer: (trackId) =>
    set((state) => {
      const sfuProducers = new Map(state.sfuProducers)
      sfuProducers.delete(trackId)
      return { sfuProducers }
    }),

  addSFUConsumer: (consumerId, info) =>
    set((state) => {
      const sfuConsumers = new Map(state.sfuConsumers)
      sfuConsumers.set(consumerId, info)
      return { sfuConsumers }
    }),

  removeSFUConsumer: (consumerId) =>
    set((state) => {
      const sfuConsumers = new Map(state.sfuConsumers)
      sfuConsumers.delete(consumerId)
      return { sfuConsumers }
    }),

  setActiveSpeaker: (peerId) => set({ activeSpeakerPeerId: peerId }),

  pauseSFUConsumer: (consumerId) =>
    set((state) => {
      const sfuConsumers = new Map(state.sfuConsumers)
      const existing = sfuConsumers.get(consumerId)
      if (existing) {
        sfuConsumers.set(consumerId, { ...existing, paused: true })
      }
      return { sfuConsumers }
    }),

  resumeSFUConsumer: (consumerId) =>
    set((state) => {
      const sfuConsumers = new Map(state.sfuConsumers)
      const existing = sfuConsumers.get(consumerId)
      if (existing) {
        sfuConsumers.set(consumerId, { ...existing, paused: false })
      }
      return { sfuConsumers }
    }),
}))
