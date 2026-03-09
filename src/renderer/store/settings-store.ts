import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QualityPreset } from '../types/protocol'

interface SettingsState {
  peerId: string
  displayName: string
  signalingUrl: string
  autoConnect: boolean
  desktopNotifications: boolean
  messageSigning: boolean
  e2eEncryption: boolean

  // Media settings
  qualityPreset: QualityPreset
  preferredCodec: 'auto' | 'h264' | 'vp8' | 'vp9'
  audioBitrate: number

  cameraDeviceId: string
  micDeviceId: string
  speakerDeviceId: string

  // Avatar
  avatarDataUrl: string

  // Integrations
  giphyApiKey: string

  // Privacy
  messageAutoDeleteTtl: number // 0 = disabled

  // SFU
  sfuEnabled: boolean

  // STUN/TURN
  stunServers: string[]
  turnServer: string
  turnUsername: string
  turnPassword: string

  // Actions
  setPeerId: (id: string) => void
  setDisplayName: (name: string) => void
  setAvatarDataUrl: (url: string) => void
  setGiphyApiKey: (key: string) => void
  setSignalingUrl: (url: string) => void
  setAutoConnect: (enabled: boolean) => void
  setDesktopNotifications: (enabled: boolean) => void
  setMessageSigning: (enabled: boolean) => void
  setE2EEncryption: (enabled: boolean) => void
  setQualityPreset: (preset: QualityPreset) => void
  setPreferredCodec: (codec: SettingsState['preferredCodec']) => void
  setAudioBitrate: (bitrate: number) => void
  setCameraDeviceId: (id: string) => void
  setMicDeviceId: (id: string) => void
  setSpeakerDeviceId: (id: string) => void
  setMessageAutoDeleteTtl: (ttl: number) => void
  setSfuEnabled: (enabled: boolean) => void
  setStunServers: (servers: string[]) => void
  setTurnServer: (server: string) => void
  setTurnCredentials: (username: string, password: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      peerId: '',
      displayName: 'Neon User',
      signalingUrl: 'wss://localhost:8080',
      autoConnect: false,
      desktopNotifications: true,
      messageSigning: true,
      e2eEncryption: false,

      qualityPreset: 'high',
      preferredCodec: 'auto',
      audioBitrate: 0,
      cameraDeviceId: '',
      micDeviceId: '',
      speakerDeviceId: '',

      avatarDataUrl: '',

      giphyApiKey: '',

      messageAutoDeleteTtl: 0,

      sfuEnabled: true,

      stunServers: ['stun:stun.l.google.com:19302'],
      turnServer: '',
      turnUsername: '',
      turnPassword: '',

      setPeerId: (id) => set({ peerId: id }),
      setDisplayName: (name) => set({ displayName: name }),
      setAvatarDataUrl: (url) => set({ avatarDataUrl: url }),
      setGiphyApiKey: (key) => set({ giphyApiKey: key }),
      setSignalingUrl: (url) => {
        if (url.startsWith('ws://') && !url.startsWith('ws://localhost') && !url.startsWith('ws://127.0.0.1')) {
          console.warn('[Settings] Using unencrypted ws:// signaling URL is insecure. Use wss:// for production.')
        }
        set({ signalingUrl: url })
      },
      setAutoConnect: (enabled) => set({ autoConnect: enabled }),
      setDesktopNotifications: (enabled) => set({ desktopNotifications: enabled }),
      setMessageSigning: (enabled) => set({ messageSigning: enabled }),
      setE2EEncryption: (enabled) => set({ e2eEncryption: enabled }),
      setQualityPreset: (preset) => set({ qualityPreset: preset }),
      setPreferredCodec: (codec) => set({ preferredCodec: codec }),
      setAudioBitrate: (bitrate) => set({ audioBitrate: bitrate }),
      setCameraDeviceId: (id) => set({ cameraDeviceId: id }),
      setMicDeviceId: (id) => set({ micDeviceId: id }),
      setSpeakerDeviceId: (id) => set({ speakerDeviceId: id }),
      setMessageAutoDeleteTtl: (ttl) => set({ messageAutoDeleteTtl: ttl }),
      setSfuEnabled: (enabled) => set({ sfuEnabled: enabled }),
      setStunServers: (servers) => set({ stunServers: servers }),
      setTurnServer: (server) => set({ turnServer: server }),
      setTurnCredentials: (username, password) => set({ turnUsername: username, turnPassword: password }),
    }),
    {
      name: 'neon-peeper-settings',
    }
  )
)
