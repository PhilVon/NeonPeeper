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
  inCall: boolean
  callPeerId: string | null

  setLocalCameraStream: (stream: MediaStream | null) => void
  setLocalScreenStream: (stream: MediaStream | null) => void
  setAudioMuted: (muted: boolean) => void
  setVideoEnabled: (enabled: boolean) => void
  addRemoteStream: (peerId: string, stream: MediaStream) => void
  removeRemoteStream: (peerId: string) => void
  addRemoteScreenStream: (peerId: string, stream: MediaStream) => void
  removeRemoteScreenStream: (peerId: string) => void
  setCurrentQuality: (quality: QualityPreset) => void
  setInCall: (inCall: boolean, peerId?: string | null) => void
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
  inCall: false,
  callPeerId: null,

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

  setInCall: (inCall, peerId = null) => set({ inCall, callPeerId: peerId }),

  clearAllStreams: () =>
    set((state) => {
      state.localCameraStream?.getTracks().forEach((t) => t.stop())
      state.localScreenStream?.getTracks().forEach((t) => t.stop())
      return {
        localCameraStream: null,
        localScreenStream: null,
        remoteStreams: new Map(),
        remoteScreenStreams: new Map(),
        inCall: false,
        callPeerId: null,
      }
    }),
}))
