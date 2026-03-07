import { useEffect, useRef, useCallback } from 'react'
import { useMediaStore } from '../store/media-store'
import { getMediaManager } from '../services/MediaManager'

export function useMediaStream() {
  const localCameraStream = useMediaStore((s) => s.localCameraStream)
  const audioMuted = useMediaStore((s) => s.audioMuted)
  const videoEnabled = useMediaStore((s) => s.videoEnabled)
  const remoteStreams = useMediaStore((s) => s.remoteStreams)
  const inCall = useMediaStore((s) => s.inCall)
  const mm = getMediaManager()

  const startCamera = useCallback(async () => {
    return mm.startCamera()
  }, [mm])

  const stopCamera = useCallback(() => {
    mm.stopCamera()
  }, [mm])

  const toggleAudio = useCallback(() => {
    return mm.toggleAudio()
  }, [mm])

  const toggleVideo = useCallback(() => {
    return mm.toggleVideo()
  }, [mm])

  return {
    localCameraStream,
    audioMuted,
    videoEnabled,
    remoteStreams,
    inCall,
    startCamera,
    stopCamera,
    toggleAudio,
    toggleVideo,
  }
}

export function useVideoRef(stream: MediaStream | null) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return videoRef
}
