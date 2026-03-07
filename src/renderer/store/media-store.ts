import { create } from 'zustand'
import type { QualityPreset } from '../types/protocol'
import type { RemoteStream } from '../types/media'

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
      }
    }),
}))
