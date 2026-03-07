import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QualityPreset } from '../types/protocol'

interface SettingsState {
  displayName: string
  signalingUrl: string
  autoConnect: boolean
  desktopNotifications: boolean
  messageSigning: boolean

  // Media settings
  qualityPreset: QualityPreset
  preferredCodec: 'auto' | 'h264' | 'vp8' | 'vp9'
  cameraDeviceId: string
  micDeviceId: string
  speakerDeviceId: string

  // Avatar
  avatarDataUrl: string

  // Integrations
  giphyApiKey: string

  // STUN/TURN
  stunServers: string[]
  turnServer: string
  turnUsername: string
  turnPassword: string

  // Actions
  setDisplayName: (name: string) => void
  setAvatarDataUrl: (url: string) => void
  setGiphyApiKey: (key: string) => void
  setSignalingUrl: (url: string) => void
  setAutoConnect: (enabled: boolean) => void
  setDesktopNotifications: (enabled: boolean) => void
  setMessageSigning: (enabled: boolean) => void
  setQualityPreset: (preset: QualityPreset) => void
  setPreferredCodec: (codec: SettingsState['preferredCodec']) => void
  setCameraDeviceId: (id: string) => void
  setMicDeviceId: (id: string) => void
  setSpeakerDeviceId: (id: string) => void
  setStunServers: (servers: string[]) => void
  setTurnServer: (server: string) => void
  setTurnCredentials: (username: string, password: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      displayName: 'Neon User',
      signalingUrl: 'ws://localhost:8080',
      autoConnect: false,
      desktopNotifications: true,
      messageSigning: false,

      qualityPreset: 'high',
      preferredCodec: 'auto',
      cameraDeviceId: '',
      micDeviceId: '',
      speakerDeviceId: '',

      avatarDataUrl: '',

      giphyApiKey: '',

      stunServers: ['stun:stun.l.google.com:19302'],
      turnServer: '',
      turnUsername: '',
      turnPassword: '',

      setDisplayName: (name) => set({ displayName: name }),
      setAvatarDataUrl: (url) => set({ avatarDataUrl: url }),
      setGiphyApiKey: (key) => set({ giphyApiKey: key }),
      setSignalingUrl: (url) => set({ signalingUrl: url }),
      setAutoConnect: (enabled) => set({ autoConnect: enabled }),
      setDesktopNotifications: (enabled) => set({ desktopNotifications: enabled }),
      setMessageSigning: (enabled) => set({ messageSigning: enabled }),
      setQualityPreset: (preset) => set({ qualityPreset: preset }),
      setPreferredCodec: (codec) => set({ preferredCodec: codec }),
      setCameraDeviceId: (id) => set({ cameraDeviceId: id }),
      setMicDeviceId: (id) => set({ micDeviceId: id }),
      setSpeakerDeviceId: (id) => set({ speakerDeviceId: id }),
      setStunServers: (servers) => set({ stunServers: servers }),
      setTurnServer: (server) => set({ turnServer: server }),
      setTurnCredentials: (username, password) => set({ turnUsername: username, turnPassword: password }),
    }),
    {
      name: 'neon-peeper-settings',
    }
  )
)
