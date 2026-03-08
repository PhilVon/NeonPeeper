import { useMediaStore } from '../store/media-store'
import { useSettingsStore } from '../store/settings-store'
import { usePeerStore } from '../store/peer-store'
import { QUALITY_PRESETS } from '../types/media'
import type { QualityPreset } from '../types/protocol'
import { createMessage } from '../types/protocol'
import { getConnectionManager } from './ConnectionManager'
import { getSFUClient, type Topology } from './SFUClient'

export class MediaManager {
  private localStream: MediaStream | null = null
  private topology: Topology = 'direct'

  setTopology(topology: Topology): void {
    this.topology = topology
    useMediaStore.getState().setTopology(topology)
  }

  getTopology(): Topology {
    return this.topology
  }

  async handleTopologySwitch(from: Topology, to: Topology): Promise<void> {
    if (from !== 'sfu' && to === 'sfu') {
      // mesh → SFU: produce all local tracks via SFU, remove from peer connections
      const sfu = getSFUClient()
      const cm = getConnectionManager()

      if (this.localStream) {
        for (const track of this.localStream.getTracks()) {
          try {
            const producerId = await sfu.produce(track, track.kind === 'video')
            useMediaStore.getState().setSFUProducer(track.id, producerId)
          } catch (err) {
            console.error('[MediaManager] Failed to produce track via SFU:', err)
          }
        }

        // Remove media tracks from peer connections (keep DataChannels)
        for (const peerId of cm.getConnectedPeerIds()) {
          this.removeTracksFromConnection(peerId)
        }
      }
    } else if (from === 'sfu' && to !== 'sfu') {
      // SFU → mesh: disconnect SFU, re-add tracks to peer connections
      const sfu = getSFUClient()
      const cm = getConnectionManager()

      await sfu.disconnect()
      useMediaStore.getState().setTopology(to)

      if (this.localStream) {
        for (const peerId of cm.getConnectedPeerIds()) {
          this.addTracksToConnection(peerId)
        }
      }
    }

    this.setTopology(to)
  }

  async startMicOnly(): Promise<MediaStream> {
    const settings = useSettingsStore.getState()
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        ...(settings.micDeviceId ? { deviceId: { exact: settings.micDeviceId } } : {}),
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    useMediaStore.getState().setLocalCameraStream(this.localStream)
    return this.localStream
  }

  async startCamera(quality?: QualityPreset): Promise<MediaStream> {
    const preset = quality || useSettingsStore.getState().qualityPreset
    const config = preset !== 'adaptive' ? QUALITY_PRESETS[preset] : QUALITY_PRESETS.high

    const settings = useSettingsStore.getState()

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: config.width },
        height: { ideal: config.height },
        frameRate: { ideal: config.frameRate },
        ...(settings.cameraDeviceId ? { deviceId: { exact: settings.cameraDeviceId } } : {}),
      },
      audio: {
        ...(settings.micDeviceId ? { deviceId: { exact: settings.micDeviceId } } : {}),
        echoCancellation: true,
        noiseSuppression: true,
      },
    }

    this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
    useMediaStore.getState().setLocalCameraStream(this.localStream)

    // If in SFU mode, produce tracks via SFU
    if (this.topology === 'sfu') {
      const sfu = getSFUClient()
      if (sfu.isConnected()) {
        for (const track of this.localStream.getTracks()) {
          try {
            const producerId = await sfu.produce(track, track.kind === 'video')
            useMediaStore.getState().setSFUProducer(track.id, producerId)
          } catch (err) {
            console.error('[MediaManager] SFU produce error:', err)
          }
        }
      }
    }

    return this.localStream
  }

  stopCamera(): void {
    if (this.localStream) {
      // Stop SFU producers
      if (this.topology === 'sfu') {
        const sfu = getSFUClient()
        for (const track of this.localStream.getTracks()) {
          sfu.stopProducing(track.id).catch(() => {})
          useMediaStore.getState().removeSFUProducer(track.id)
        }
      }

      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
      useMediaStore.getState().setLocalCameraStream(null)
    }
  }

  toggleAudio(): boolean {
    if (!this.localStream) return false
    const audioTracks = this.localStream.getAudioTracks()
    const newMuted = !useMediaStore.getState().audioMuted
    audioTracks.forEach((t) => (t.enabled = !newMuted))
    useMediaStore.getState().setAudioMuted(newMuted)
    return newMuted
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.localStream) return false
    const videoTracks = this.localStream.getVideoTracks()

    if (videoTracks.length === 0) {
      // Audio-only mode: acquire camera and add track to stream + connections
      const preset = useSettingsStore.getState().qualityPreset
      const config = preset !== 'adaptive' ? QUALITY_PRESETS[preset] : QUALITY_PRESETS.high
      const settings = useSettingsStore.getState()

      const camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: config.width },
          height: { ideal: config.height },
          frameRate: { ideal: config.frameRate },
          ...(settings.cameraDeviceId ? { deviceId: { exact: settings.cameraDeviceId } } : {}),
        },
      })

      const newTrack = camStream.getVideoTracks()[0]
      this.localStream.addTrack(newTrack)

      const cm = getConnectionManager()
      for (const peerId of cm.getConnectedPeerIds()) {
        const pc = cm.getPeerConnection(peerId)
        if (pc) {
          pc.addTrack(newTrack, this.localStream)
        }
      }

      useMediaStore.getState().setVideoEnabled(true)
      useMediaStore.getState().setLocalCameraStream(this.localStream)
      return true
    }

    // Normal toggle: enable/disable existing video tracks
    const newEnabled = !useMediaStore.getState().videoEnabled
    videoTracks.forEach((t) => (t.enabled = newEnabled))
    useMediaStore.getState().setVideoEnabled(newEnabled)
    return newEnabled
  }

  async switchCamera(deviceId: string): Promise<void> {
    if (!this.localStream) return

    const oldVideoTrack = this.localStream.getVideoTracks()[0]
    if (!oldVideoTrack) return

    const preset = useSettingsStore.getState().qualityPreset
    const config = preset !== 'adaptive' ? QUALITY_PRESETS[preset] : QUALITY_PRESETS.high

    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: config.width },
        height: { ideal: config.height },
        frameRate: { ideal: config.frameRate },
      },
    })

    const newTrack = newStream.getVideoTracks()[0]
    this.localStream.removeTrack(oldVideoTrack)
    this.localStream.addTrack(newTrack)
    oldVideoTrack.stop()

    if (this.topology === 'sfu') {
      // SFU path: stop old producer, produce new track
      const sfu = getSFUClient()
      await sfu.stopProducing(oldVideoTrack.id)
      useMediaStore.getState().removeSFUProducer(oldVideoTrack.id)
      try {
        const producerId = await sfu.produce(newTrack, true)
        useMediaStore.getState().setSFUProducer(newTrack.id, producerId)
      } catch (err) {
        console.error('[MediaManager] SFU camera switch error:', err)
      }
    } else {
      // Mesh path: replace track on all peer connections
      const cm = getConnectionManager()
      for (const peerId of cm.getConnectedPeerIds()) {
        const pc = cm.getPeerConnection(peerId)
        if (!pc) continue
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(newTrack)
        }
      }
    }

    useSettingsStore.getState().setCameraDeviceId(deviceId)
  }

  async switchMic(deviceId: string): Promise<void> {
    if (!this.localStream) return

    const oldAudioTrack = this.localStream.getAudioTracks()[0]
    if (!oldAudioTrack) return

    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true },
    })

    const newTrack = newStream.getAudioTracks()[0]
    this.localStream.removeTrack(oldAudioTrack)
    this.localStream.addTrack(newTrack)
    oldAudioTrack.stop()

    if (this.topology === 'sfu') {
      // SFU path: stop old producer, produce new track
      const sfu = getSFUClient()
      await sfu.stopProducing(oldAudioTrack.id)
      useMediaStore.getState().removeSFUProducer(oldAudioTrack.id)
      try {
        const producerId = await sfu.produce(newTrack, false)
        useMediaStore.getState().setSFUProducer(newTrack.id, producerId)
      } catch (err) {
        console.error('[MediaManager] SFU mic switch error:', err)
      }
    } else {
      const cm = getConnectionManager()
      for (const peerId of cm.getConnectedPeerIds()) {
        const pc = cm.getPeerConnection(peerId)
        if (!pc) continue
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio')
        if (sender) {
          await sender.replaceTrack(newTrack)
        }
      }
    }

    useSettingsStore.getState().setMicDeviceId(deviceId)
  }

  async applyQualityPreset(preset: QualityPreset, peerId?: string): Promise<void> {
    if (preset === 'adaptive') return
    const config = QUALITY_PRESETS[preset]

    const cm = getConnectionManager()
    const peerIds = peerId ? [peerId] : cm.getConnectedPeerIds()

    for (const pid of peerIds) {
      const pc = cm.getPeerConnection(pid)
      if (!pc) continue

      const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (videoSender) {
        const params = videoSender.getParameters()
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}]
        }
        params.encodings[0].maxBitrate = config.videoBitrate
        params.encodings[0].maxFramerate = config.frameRate
        await videoSender.setParameters(params)
      }
    }

    useMediaStore.getState().setCurrentQuality(preset)
  }

  addTracksToConnection(peerId: string): void {
    if (!this.localStream) return
    const pc = getConnectionManager().getPeerConnection(peerId)
    if (!pc) return

    const existingSenderTracks = pc.getSenders().map((s) => s.track).filter(Boolean)
    for (const track of this.localStream.getTracks()) {
      if (!existingSenderTracks.includes(track)) {
        pc.addTrack(track, this.localStream)
      }
    }

    this.applyCodecPreference(pc)
    this.applyAudioBitrate(peerId).catch((err) => console.error('[MediaManager] Audio bitrate error:', err))
  }

  removeTracksFromConnection(peerId: string): void {
    const pc = getConnectionManager().getPeerConnection(peerId)
    if (!pc) return

    const cameraTracks = this.localStream?.getTracks() ?? []
    for (const sender of pc.getSenders()) {
      if (sender.track && cameraTracks.includes(sender.track)) {
        pc.removeTrack(sender)
      }
    }
  }

  async applyAudioBitrate(peerId: string): Promise<void> {
    const localProfile = usePeerStore.getState().localProfile
    const peerProfile = usePeerStore.getState().peers.get(peerId)
    if (!localProfile || !peerProfile) return

    const localBitrate = localProfile.audioBitrate || 0
    const remoteBitrate = peerProfile.audioBitrate || 0

    let targetBitrate = 0
    if (localBitrate > 0 && remoteBitrate > 0) {
      targetBitrate = Math.min(localBitrate, remoteBitrate)
    } else if (localBitrate > 0) {
      targetBitrate = localBitrate
    } else if (remoteBitrate > 0) {
      targetBitrate = remoteBitrate
    }

    if (targetBitrate === 0) return

    const pc = getConnectionManager().getPeerConnection(peerId)
    if (!pc) return

    const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio')
    if (audioSender) {
      try {
        const params = audioSender.getParameters()
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}]
        }
        params.encodings[0].maxBitrate = targetBitrate
        await audioSender.setParameters(params)
      } catch (err) {
        console.error('[MediaManager] Failed to apply audio bitrate:', err)
      }
    }
  }

  // --- Screen sharing ---

  private screenStream: MediaStream | null = null

  async startScreenShare(sourceId: string, chatId?: string): Promise<MediaStream> {
    // Use Electron's desktopCapturer source as a constraint
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30,
        },
      } as unknown as MediaTrackConstraints,
    })

    this.screenStream = stream
    useMediaStore.getState().setLocalScreenStream(stream)

    if (this.topology === 'sfu') {
      // SFU path: produce screen track via SFU
      const sfu = getSFUClient()
      for (const track of stream.getTracks()) {
        try {
          const producerId = await sfu.produce(track, true)
          useMediaStore.getState().setSFUProducer(track.id, producerId)
        } catch (err) {
          console.error('[MediaManager] SFU screen share error:', err)
        }
      }
    } else {
      // Mesh path: add screen track to all peer connections and renegotiate
      const cm = getConnectionManager()
      const localId = usePeerStore.getState().localProfile?.id ?? ''
      for (const peerId of cm.getConnectedPeerIds()) {
        const pc = cm.getPeerConnection(peerId)
        if (pc) {
          for (const track of stream.getTracks()) {
            pc.addTrack(track, stream)
          }
          // Renegotiate so remote peer receives the new screen track
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer).then(() => offer))
            .then((offer) => {
              const msg = createMessage('MEDIA_OFFER', localId, peerId, {
                sdp: offer.sdp!,
                mediaType: 'screen',
              }, chatId)
              cm.sendMessage(peerId, msg)
            })
            .catch((err) => console.error('[MediaManager] Screen share renegotiation error:', err))
        }
      }

      // Apply codec preference to connections with screen tracks
      for (const peerId of cm.getConnectedPeerIds()) {
        const pc = cm.getPeerConnection(peerId)
        if (pc) this.applyCodecPreference(pc)
      }
    }

    // Handle stream ending (user clicks "Stop sharing" in OS UI)
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      this.stopScreenShare()
    })

    return stream
  }

  stopScreenShare(chatId?: string): void {
    if (this.screenStream) {
      if (this.topology === 'sfu') {
        // SFU path: stop screen producers
        const sfu = getSFUClient()
        for (const track of this.screenStream.getTracks()) {
          sfu.stopProducing(track.id).catch(() => {})
          useMediaStore.getState().removeSFUProducer(track.id)
        }
      } else {
        // Mesh path: remove tracks from peer connections, notify, and renegotiate
        const cm = getConnectionManager()
        const localId = usePeerStore.getState().localProfile?.id ?? ''
        const screenTracks = this.screenStream.getTracks()

        for (const peerId of cm.getConnectedPeerIds()) {
          const pc = cm.getPeerConnection(peerId)
          if (pc) {
            const senders = pc.getSenders()
            for (const sender of senders) {
              if (sender.track && screenTracks.includes(sender.track)) {
                pc.removeTrack(sender)
              }
            }

            // Notify remote peer that screen share stopped
            const stopMsg = createMessage('MEDIA_STOP', localId, peerId, {
              mediaType: 'screen',
              trackId: '',
            }, chatId)
            cm.sendMessage(peerId, stopMsg)

            // Renegotiate so remote SDP reflects removed track
            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer).then(() => offer))
              .then((offer) => {
                const msg = createMessage('MEDIA_OFFER', localId, peerId, {
                  sdp: offer.sdp!,
                  mediaType: 'screen',
                }, chatId)
                cm.sendMessage(peerId, msg)
              })
              .catch((err) => console.error('[MediaManager] Screen stop renegotiation error:', err))
          }
        }
      }

      this.screenStream.getTracks().forEach((t) => t.stop())
      this.screenStream = null
      useMediaStore.getState().setLocalScreenStream(null)
    }
  }

  private applyCodecPreference(pc: RTCPeerConnection): void {
    const preferred = useSettingsStore.getState().preferredCodec
    if (preferred === 'auto') return

    const capabilities = RTCRtpReceiver.getCapabilities?.('video')
    if (!capabilities) return

    const sorted = [...capabilities.codecs].sort((a, b) => {
      const aMatch = a.mimeType.toLowerCase().includes(preferred) ? -1 : 0
      const bMatch = b.mimeType.toLowerCase().includes(preferred) ? -1 : 0
      return aMatch - bMatch
    })

    for (const transceiver of pc.getTransceivers()) {
      if (transceiver.receiver.track?.kind === 'video' || transceiver.sender.track?.kind === 'video') {
        try {
          transceiver.setCodecPreferences(sorted)
        } catch {
          // setCodecPreferences not supported or invalid
        }
      }
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  async getDevices(): Promise<{
    cameras: MediaDeviceInfo[]
    microphones: MediaDeviceInfo[]
    speakers: MediaDeviceInfo[]
  }> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return {
      cameras: devices.filter((d) => d.kind === 'videoinput'),
      microphones: devices.filter((d) => d.kind === 'audioinput'),
      speakers: devices.filter((d) => d.kind === 'audiooutput'),
    }
  }
}

// Singleton
let mediaManagerInstance: MediaManager | null = null

export function getMediaManager(): MediaManager {
  if (!mediaManagerInstance) {
    mediaManagerInstance = new MediaManager()
  }
  return mediaManagerInstance
}
