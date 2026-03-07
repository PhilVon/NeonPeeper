import { useMediaStore } from '../store/media-store'
import { useSettingsStore } from '../store/settings-store'
import { usePeerStore } from '../store/peer-store'
import { QUALITY_PRESETS } from '../types/media'
import type { QualityPreset } from '../types/protocol'
import { createMessage } from '../types/protocol'
import { getConnectionManager } from './ConnectionManager'

export class MediaManager {
  private localStream: MediaStream | null = null

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
    return this.localStream
  }

  stopCamera(): void {
    if (this.localStream) {
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

  toggleVideo(): boolean {
    if (!this.localStream) return false
    const videoTracks = this.localStream.getVideoTracks()
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

    // Replace track on all peer connections
    const cm = getConnectionManager()
    for (const peerId of cm.getConnectedPeerIds()) {
      const pc = cm.getPeerConnection(peerId)
      if (!pc) continue
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(newTrack)
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

    const cm = getConnectionManager()
    for (const peerId of cm.getConnectedPeerIds()) {
      const pc = cm.getPeerConnection(peerId)
      if (!pc) continue
      const sender = pc.getSenders().find((s) => s.track?.kind === 'audio')
      if (sender) {
        await sender.replaceTrack(newTrack)
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

    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream)
    }
  }

  removeTracksFromConnection(peerId: string): void {
    const pc = getConnectionManager().getPeerConnection(peerId)
    if (!pc) return

    const senders = pc.getSenders()
    for (const sender of senders) {
      if (sender.track) {
        pc.removeTrack(sender)
      }
    }
  }

  // --- Screen sharing ---

  private screenStream: MediaStream | null = null

  async startScreenShare(sourceId: string): Promise<MediaStream> {
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

    // Add screen track to all peer connections and renegotiate
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
            })
            cm.sendMessage(peerId, msg)
          })
          .catch((err) => console.error('[MediaManager] Screen share renegotiation error:', err))
      }
    }

    // Handle stream ending (user clicks "Stop sharing" in OS UI)
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      this.stopScreenShare()
    })

    return stream
  }

  stopScreenShare(): void {
    if (this.screenStream) {
      // Remove tracks from peer connections, notify, and renegotiate
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
          })
          cm.sendMessage(peerId, stopMsg)

          // Renegotiate so remote SDP reflects removed track
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer).then(() => offer))
            .then((offer) => {
              const msg = createMessage('MEDIA_OFFER', localId, peerId, {
                sdp: offer.sdp!,
                mediaType: 'screen',
              })
              cm.sendMessage(peerId, msg)
            })
            .catch((err) => console.error('[MediaManager] Screen stop renegotiation error:', err))
        }
      }

      this.screenStream.getTracks().forEach((t) => t.stop())
      this.screenStream = null
      useMediaStore.getState().setLocalScreenStream(null)
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
